import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch, hubspotFetch, PROSPECT_ACTIONS, LEAD_ACTIONS } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

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

  const key = cacheKey("previous-period", { from, to });
  const data = await cached(key, TTL.VERY_LONG, async () => {
    // Calculate previous period of the same duration
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const durationMs = toDate.getTime() - fromDate.getTime();
    const prevToDate = new Date(fromDate.getTime() - 1); // day before current from
    const prevFromDate = new Date(prevToDate.getTime() - durationMs);

    const prevFrom = prevFromDate.toISOString().split("T")[0];
    const prevTo = prevToDate.toISOString().split("T")[0];

    const prevFromMs = londonDateToUtcMs(prevFrom, "00:00:00");
    const prevToMs = londonDateToUtcMs(prevTo, "23:59:59");

    const dateFilters = [
      { propertyName: "createdate", operator: "GTE", value: prevFromMs.toString() },
      { propertyName: "createdate", operator: "LTE", value: prevToMs.toString() },
      LIFECYCLE_EXCLUSION_FILTER,
    ];

    // Run all 4 counts in parallel — each is a single HubSpot search with
    // limit:1 (just getting the `total`). Parallel is safe: HubSpot allows
    // ~4 requests/sec on private apps and these are lightweight.
    const [contactsResult, prospectsResult, leadsResult, homeVisitsResult] = await Promise.all([
      hubspotSearch(token, {
        filterGroups: [
          { filters: [{ propertyName: "conversion_action", operator: "HAS_PROPERTY" }, ...dateFilters] },
        ],
        properties: ["email"],
        limit: 1,
      }),
      hubspotSearch(token, {
        filterGroups: [
          { filters: [{ propertyName: "conversion_action", operator: "IN", values: PROSPECT_ACTIONS }, ...dateFilters] },
        ],
        properties: ["email"],
        limit: 1,
      }),
      hubspotSearch(token, {
        filterGroups: [
          { filters: [{ propertyName: "conversion_action", operator: "IN", values: LEAD_ACTIONS }, ...dateFilters] },
        ],
        properties: ["email"],
        limit: 1,
      }),
      hubspotSearch(token, {
        filterGroups: [
          {
            filters: [
              { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "GTE", value: prevFromMs.toString() },
              { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "LTE", value: prevToMs.toString() },
              LIFECYCLE_EXCLUSION_FILTER,
            ],
          },
        ],
        properties: ["email"],
        limit: 1,
      }),
    ]);

    const contacts = contactsResult.total ?? 0;
    const prospects = prospectsResult.total ?? 0;
    const leads = leadsResult.total ?? 0;
    const homeVisits = homeVisitsResult.total ?? 0;

    // Won jobs — two sequential stage queries (small, fast)
    const WON_WAITING_STAGE = "151694551";
    const COMPLETED_STAGE = "151694559";
    let wonJobs = 0;
    let wonValue = 0;
    for (const stage of [WON_WAITING_STAGE, COMPLETED_STAGE]) {
      const wonResult = await hubspotSearch(token, {
        filterGroups: [
          {
            filters: [
              { propertyName: "lifecyclestage", operator: "EQ", value: stage },
              { propertyName: "first_deal_created_date", operator: "GTE", value: prevFromMs.toString() },
              { propertyName: "first_deal_created_date", operator: "LTE", value: prevToMs.toString() },
            ],
          },
        ],
        properties: ["recent_deal_amount"],
        limit: 100,
      });
      wonJobs += wonResult.total ?? 0;
      for (const c of wonResult.results ?? []) {
        const amt = parseFloat(c.properties?.recent_deal_amount ?? "0");
        if (!isNaN(amt)) wonValue += amt;
      }
    }

    return {
      contacts,
      prospects,
      leads,
      homeVisits,
      wonJobs,
      wonValue: Math.round(wonValue),
      // Echo back the calculated previous period for the UI label
      from: prevFrom,
      to: prevTo,
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
