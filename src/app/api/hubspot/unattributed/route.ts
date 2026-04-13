import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return Response.json({ error: "Missing params" }, { status: 400 });

  const key = cacheKey("unattributed", { from, to });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    // Count contacts created in range with NO original_lead_source set —
    // these are the ones the dashboard warning labels as "without a source".
    // Matches what Pete sees when he filters HubSpot contacts by
    // "Original lead source is unknown".
    const noSourceBody = {
      filterGroups: [{
        filters: [
          { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
          { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
          { propertyName: "original_lead_source", operator: "NOT_HAS_PROPERTY" },
          LIFECYCLE_EXCLUSION_FILTER,
        ],
      }],
      properties: ["createdate"],
      limit: 1,
    };

    // Same set, narrowed to those who also booked a home visit
    const visitNoSourceBody = {
      filterGroups: [{
        filters: [
          { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
          { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
          { propertyName: "original_lead_source", operator: "NOT_HAS_PROPERTY" },
          { propertyName: "date_that_initial_visit_booked_is_set_to_yes", operator: "HAS_PROPERTY" },
          LIFECYCLE_EXCLUSION_FILTER,
        ],
      }],
      properties: ["createdate"],
      limit: 1,
    };

    const [noSourceResult, visitNoSourceResult] = await Promise.all([
      hubspotSearch(token, noSourceBody),
      hubspotSearch(token, visitNoSourceBody),
    ]);

    return {
      contactsWithoutSource: noSourceResult.total,
      visitsWithoutSource: visitNoSourceResult.total,
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
