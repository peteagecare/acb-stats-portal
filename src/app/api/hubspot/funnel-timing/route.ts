import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";

const HUBSPOT_API = "https://api.hubapi.com";
const TZ = "Europe/London";

/**
 * Average time spent at each step in the funnel — using HubSpot's
 * lifecycle-stage entry dates per contact.
 *
 * The three pairs we care about:
 *   1. Prospect → Lead    (entered Lead stage minus entered Prospect stage)
 *   2. Lead → Home Visit  (entered Home Visit/Deal minus entered Lead)
 *   3. Prospect → Home Visit (entered Home Visit/Deal minus entered Prospect)
 *
 * Stage IDs (from HubSpot lifecyclestage property options on this portal):
 *   - Prospect:        2444598513   →  hs_v2_date_entered_2444598513
 *   - Lead:            5118566641   →  hs_v2_date_entered_5118566641
 *   - Home Visit/Deal: "lead"       →  hs_v2_date_entered_lead
 *     (yes, internal value is literally "lead" — predates the proper Lead stage)
 *
 * Period filter: contacts whose `date_that_initial_visit_booked_is_set_to_yes`
 * falls in [from, to] — matches the existing dashboard's Home Visits KPI so
 * the timings line up with the volume number you're already looking at.
 *
 * Contacts that skipped a stage (e.g. went straight from Lead to Home Visit
 * without ever being a Prospect) are excluded from the relevant averages.
 * Each metric also returns its sample size so the UI can show "based on N".
 */

const PROSPECT_DATE = "hs_v2_date_entered_2444598513";
const LEAD_DATE = "hs_v2_date_entered_5118566641";
const HOMEVISIT_DATE = "hs_v2_date_entered_lead";

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

  // Three running totals — sum of (delta in days) and a count
  let prospectToLeadSum = 0;
  let prospectToLeadCount = 0;
  let leadToVisitSum = 0;
  let leadToVisitCount = 0;
  let prospectToVisitSum = 0;
  let prospectToVisitCount = 0;

  try {
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
        properties: [PROSPECT_DATE, LEAD_DATE, HOMEVISIT_DATE],
        limit: 100,
        sorts: [{ propertyName: "date_that_initial_visit_booked_is_set_to_yes", direction: "ASCENDING" }],
      };
      if (after) body.after = after;

      const data = await hubspotSearch(token, body);
      for (const c of data.results ?? []) {
        const pRaw = c.properties?.[PROSPECT_DATE];
        const lRaw = c.properties?.[LEAD_DATE];
        const hRaw = c.properties?.[HOMEVISIT_DATE];
        const p = pRaw ? Date.parse(pRaw) : NaN;
        const l = lRaw ? Date.parse(lRaw) : NaN;
        const h = hRaw ? Date.parse(hRaw) : NaN;

        const dayMs = 1000 * 60 * 60 * 24;
        if (Number.isFinite(p) && Number.isFinite(l) && l >= p) {
          prospectToLeadSum += (l - p) / dayMs;
          prospectToLeadCount += 1;
        }
        if (Number.isFinite(l) && Number.isFinite(h) && h >= l) {
          leadToVisitSum += (h - l) / dayMs;
          leadToVisitCount += 1;
        }
        if (Number.isFinite(p) && Number.isFinite(h) && h >= p) {
          prospectToVisitSum += (h - p) / dayMs;
          prospectToVisitCount += 1;
        }
      }

      after = data.paging?.next?.after;
      pages++;
      if (pages >= MAX_PAGES) break;
    } while (after);

    function avg(sum: number, count: number): number | null {
      return count > 0 ? sum / count : null;
    }

    return Response.json({
      prospectToLead: { avgDays: avg(prospectToLeadSum, prospectToLeadCount), sample: prospectToLeadCount },
      leadToVisit: { avgDays: avg(leadToVisitSum, leadToVisitCount), sample: leadToVisitCount },
      prospectToVisit: { avgDays: avg(prospectToVisitSum, prospectToVisitCount), sample: prospectToVisitCount },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "HubSpot request failed" },
      { status: 502 },
    );
  }
}
