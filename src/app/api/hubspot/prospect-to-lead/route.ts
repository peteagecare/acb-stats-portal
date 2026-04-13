import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

/**
 * Real "Prospect -> Lead" conversion rate.
 *
 * The dashboard's Prospect total and Lead total are independent counts — a
 * contact whose conversion_action is a lead action was never counted as a
 * "Prospect" in the dashboard, even if they filled a brochure download form
 * first. So dividing Leads by Prospects gives a nonsensical number.
 *
 * The true question: "of people who went through the Prospect lifecycle
 * stage, how many then also entered the Lead stage?"
 *
 * We answer this by counting contacts created in the period whose
 * `hs_v2_date_entered_2444598513` (entered Prospect stage) is set,
 * then checking how many of those also have
 * `hs_v2_date_entered_5118566641` (entered Lead stage) set.
 */

const PROSPECT_ENTERED = "hs_v2_date_entered_2444598513";
const LEAD_ENTERED = "hs_v2_date_entered_5118566641";

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

  const key = cacheKey("prospect-to-lead", { from, to });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    let totalEverProspect = 0;
    let convertedToLead = 0;

    let after: string | undefined;
    let pages = 0;
    const MAX_PAGES = 80;

    do {
      const body: Record<string, unknown> = {
        filterGroups: [
          {
            filters: [
              { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
              { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
              { propertyName: PROSPECT_ENTERED, operator: "HAS_PROPERTY" },
              LIFECYCLE_EXCLUSION_FILTER,
            ],
          },
        ],
        properties: [LEAD_ENTERED],
        limit: 100,
        sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
      };
      if (after) body.after = after;

      const result = await hubspotSearch(token, body);
      for (const c of result.results ?? []) {
        totalEverProspect += 1;
        if (c.properties?.[LEAD_ENTERED]) {
          convertedToLead += 1;
        }
      }

      after = result.paging?.next?.after;
      pages++;
      if (pages >= MAX_PAGES) break;
    } while (after);

    return {
      totalEverProspect,
      convertedToLead,
      rate: totalEverProspect > 0 ? (convertedToLead / totalEverProspect) * 100 : null,
    };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
