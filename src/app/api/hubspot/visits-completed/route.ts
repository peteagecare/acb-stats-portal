import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { hubspotSearch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

/**
 * Count of home visits that ACTUALLY took place inside the period.
 *
 * Filter: `initial_home_visit_date` (the calendar date of the visit) within
 * [from, to], excluding any contact whose visit was set to Cancelled.
 *
 * `initial_home_visit_date` is a HubSpot DATE property (no time component),
 * stored as midnight UTC of the calendar day, so we don't need timezone
 * shifting on the filter values themselves.
 */

function dayStartUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 0, 0, 0);
}
function dayEndUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 23, 59, 59, 999);
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

  const key = cacheKey("visits-completed", { from, to });
  const data = await cached(key, TTL.SHORT, async () => {
    const body = {
      filterGroups: [
        {
          filters: [
            { propertyName: "initial_home_visit_date", operator: "GTE", value: dayStartUtcMs(from).toString() },
            { propertyName: "initial_home_visit_date", operator: "LTE", value: dayEndUtcMs(to).toString() },
            { propertyName: "initial_visit_booked_", operator: "NEQ", value: "Cancelled" },
            LIFECYCLE_EXCLUSION_FILTER,
          ],
        },
      ],
      properties: ["initial_home_visit_date"],
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
