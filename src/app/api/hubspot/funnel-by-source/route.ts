import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

/**
 * Returns the full customer funnel sliced by `original_lead_source`, using
 * a COHORT view: "of contacts created in this period from source X, how
 * many became prospects / leads / visits / won?"
 *
 * One paginated HubSpot search through all qualifying contacts in the
 * period; everything else is bucketed client-side, so this is a single
 * query regardless of how many sources exist.
 *
 * Note: this is intentionally a different lens from the main dashboard
 * KPIs, which use independent date filters per metric (e.g. visits
 * booked in period regardless of when the contact was created). The
 * cohort view answers "how is this source performing"; the main view
 * answers "what's happening in this period".
 */

const PROSPECT_ACTIONS = new Set([
  "Brochure Download Form", "Flipbook Form", "VAT Exempt Checker",
  "Pricing Guide", "Physical Brochure Request", "Newsletter Sign Up",
]);

const LEAD_ACTIONS = new Set([
  "Brochure - Call Me", "Request A Callback Form", "Contact Form",
  "Free Home Design Form", "Phone Call", "Walk In Bath Form",
  "Direct Email", "Brochure - Home Visit", "Pricing Guide Home Visit",
]);

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

async function fetchPropertyLabels(token: string, prop: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${HUBSPOT_API}/crm/v3/properties/contacts/${prop}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
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

interface SourceFunnel {
  contacts: number;
  prospects: number;
  formLeads: number;
  directBookings: number;
  homeVisits: number;
  wonJobs: number;
  prospectActions: Record<string, number>;
  leadActions: Record<string, number>;
}

function emptyFunnel(): SourceFunnel {
  return {
    contacts: 0,
    prospects: 0,
    formLeads: 0,
    directBookings: 0,
    homeVisits: 0,
    wonJobs: 0,
    prospectActions: {},
    leadActions: {},
  };
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

  const bySource = new Map<string, SourceFunnel>();
  function getOrCreate(key: string): SourceFunnel {
    let f = bySource.get(key);
    if (!f) {
      f = emptyFunnel();
      bySource.set(key, f);
    }
    return f;
  }

  try {
    const labelsPromise = fetchPropertyLabels(token, "original_lead_source");

    let after: string | undefined;
    let pages = 0;
    const MAX_PAGES = 80; // 8000 contact ceiling per range — generous

    do {
      const body: Record<string, unknown> = {
        filterGroups: [
          {
            filters: [
              { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
              { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
              { propertyName: "conversion_action", operator: "HAS_PROPERTY" },
              LIFECYCLE_EXCLUSION_FILTER,
            ],
          },
        ],
        properties: [
          "original_lead_source",
          "conversion_action",
          "date_that_initial_visit_booked_is_set_to_yes",
          "won_date",
        ],
        limit: 100,
        sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
      };
      if (after) body.after = after;

      const data = await hubspotSearch(token, body);
      for (const c of data.results ?? []) {
        const source = c.properties?.original_lead_source ?? "__none__";
        const action = c.properties?.conversion_action ?? "";
        const visitBooked = !!c.properties?.date_that_initial_visit_booked_is_set_to_yes;
        const won = !!c.properties?.won_date;

        const f = getOrCreate(source);
        f.contacts += 1;

        if (PROSPECT_ACTIONS.has(action)) {
          f.prospects += 1;
          f.prospectActions[action] = (f.prospectActions[action] ?? 0) + 1;
        } else if (LEAD_ACTIONS.has(action)) {
          f.formLeads += 1;
          f.leadActions[action] = (f.leadActions[action] ?? 0) + 1;
        }

        if (visitBooked) {
          f.homeVisits += 1;
          if (!LEAD_ACTIONS.has(action)) {
            f.directBookings += 1;
          }
        }

        if (won) {
          f.wonJobs += 1;
        }
      }

      after = data.paging?.next?.after;
      pages++;
      if (pages >= MAX_PAGES) break;
    } while (after);

    const labels = await labelsPromise;

    const sources = Array.from(bySource.entries())
      .map(([value, f]) => ({
        value,
        label: value === "__none__" ? "(No source)" : (labels[value] ?? value),
        ...f,
        prospectActions: Object.entries(f.prospectActions)
          .map(([k, v]) => ({ value: k, count: v }))
          .sort((a, b) => b.count - a.count),
        leadActions: Object.entries(f.leadActions)
          .map(([k, v]) => ({ value: k, count: v }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.contacts - a.contacts);

    return Response.json({ sources });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "HubSpot request failed" },
      { status: 502 },
    );
  }
}
