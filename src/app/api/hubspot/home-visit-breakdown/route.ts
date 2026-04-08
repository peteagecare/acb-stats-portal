import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

/**
 * For every contact whose `date_that_initial_visit_booked_is_set_to_yes`
 * falls in [from, to], group by:
 *
 *   1. conversion_action — what they did to get into the system
 *      (includes prospect-level actions like Brochure Download, not just
 *      lead-level ones — every action that ended up converting to a
 *      home visit)
 *
 *   2. original_lead_source — where they originally came from
 *
 * One paginated HubSpot search → tally both maps → resolve labels via
 * property options. Cheaper than N+1 search-per-option.
 */

function londonDateToUtcMs(dateStr: string, time: string): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
  });
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm, ss] = time.split(":").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, ss);
  const parts = formatter.formatToParts(new Date(utcGuess));
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "+00";
  const offsetMatch = tzPart.match(/([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;
  return Date.UTC(y, m - 1, d, hh - offsetHours, mm, ss);
}

async function hubspotSearch(token: string, body: object): Promise<{
  results: { properties: Record<string, string | null> }[];
  paging?: { next?: { after: string } };
}> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 429 && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      throw new Error(`HubSpot search failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }
  throw new Error("HubSpot search failed after retries");
}

async function fetchPropertyLabels(
  token: string,
  propertyName: string,
): Promise<Record<string, string>> {
  try {
    const res = await fetch(
      `${HUBSPOT_API}/crm/v3/properties/contacts/${propertyName}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) return {};
    const data = await res.json();
    const map: Record<string, string> = {};
    for (const opt of data.options ?? []) {
      if (opt?.value) map[opt.value] = opt.label ?? opt.value;
    }
    return map;
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return Response.json({ error: "Missing required params: from, to" }, { status: 400 });
  }

  const fromMs = londonDateToUtcMs(from, "00:00:00");
  const toMs = londonDateToUtcMs(to, "23:59:59");

  const byAction = new Map<string, number>();
  const bySource = new Map<string, number>();
  let total = 0;

  try {
    const labelsPromise = Promise.all([
      fetchPropertyLabels(token, "conversion_action"),
      fetchPropertyLabels(token, "original_lead_source"),
    ]);

    let after: string | undefined;
    let pages = 0;
    const MAX_PAGES = 50;

    do {
      const body: Record<string, unknown> = {
        filterGroups: [
          {
            filters: [
              { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "GTE", value: fromMs.toString() },
              { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "LTE", value: toMs.toString() },
              LIFECYCLE_EXCLUSION_FILTER,
            ],
          },
        ],
        properties: ["conversion_action", "original_lead_source"],
        limit: 100,
        sorts: [{ propertyName: "date_that_initial_visit_booked_is_set_to_yes", direction: "ASCENDING" }],
      };
      if (after) body.after = after;

      const data = await hubspotSearch(token, body);
      for (const c of data.results ?? []) {
        total += 1;
        const action = c.properties?.conversion_action ?? "__none__";
        const source = c.properties?.original_lead_source ?? "__none__";
        byAction.set(action, (byAction.get(action) ?? 0) + 1);
        bySource.set(source, (bySource.get(source) ?? 0) + 1);
      }

      after = data.paging?.next?.after;
      pages++;
      if (pages >= MAX_PAGES) break;
    } while (after);

    const [actionLabels, sourceLabels] = await labelsPromise;

    function serialise(map: Map<string, number>, labels: Record<string, string>, noneLabel: string) {
      return Array.from(map.entries())
        .map(([value, count]) => ({
          value,
          label: value === "__none__" ? noneLabel : (labels[value] ?? value),
          count,
        }))
        .sort((a, b) => b.count - a.count);
    }

    return Response.json({
      total,
      byAction: serialise(byAction, actionLabels, "Direct booking (no form)"),
      bySource: serialise(bySource, sourceLabels, "(No source)"),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "HubSpot request failed" },
      { status: 502 },
    );
  }
}
