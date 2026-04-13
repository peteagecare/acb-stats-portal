import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch, LEAD_ACTIONS } from "@/lib/hubspot";
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

  const key = cacheKey("organic-leads", { from, to });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    // Count contacts who:
    // 1. Had their visit booked in the date range (matches the Home Visits KPI's
    //    date semantics — booking date, NOT contact createdate)
    // 2. Are NOT already counted as a form lead (conversion_action not in LEAD_ACTIONS)
    //
    // Two filterGroups are used so we capture both:
    //   a) contacts with a non-lead conversion action
    //   b) contacts with no conversion action at all
    // (HubSpot's NOT_IN does not match contacts where the property is unset.)
    const baseFilters = [
      { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "GTE", value: fromMs.toString() },
      { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "LTE", value: toMs.toString() },
      LIFECYCLE_EXCLUSION_FILTER,
    ];

    const body = {
      filterGroups: [
        {
          filters: [
            ...baseFilters,
            { propertyName: "conversion_action", operator: "NOT_IN", values: LEAD_ACTIONS },
          ],
        },
        {
          filters: [
            ...baseFilters,
            { propertyName: "conversion_action", operator: "NOT_HAS_PROPERTY" },
          ],
        },
      ],
      properties: ["conversion_action", "date_that_initial_visit_booked_is_set_to_yes"],
      limit: 1,
    };

    const result = await hubspotSearch(token, body);
    return { total: result.total ?? 0 };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
