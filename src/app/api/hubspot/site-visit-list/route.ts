import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { hubspotSearch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

function dayStartUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 0, 0, 0);
}

function dayEndUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 23, 59, 59, 999);
}

/**
 * GET /api/hubspot/site-visit-list?from=YYYY-MM-DD&to=YYYY-MM-DD&salesman=Andy&mode=booked|scheduled
 *
 * Returns contacts with home visits in the date range.
 * - mode=booked (default): filters by date_that_initial_visit_booked_is_set_to_yes (matches "Booked In Period" card)
 * - mode=scheduled: filters by initial_home_visit_date (matches weekly calendar cards)
 * - salesman: optional filter by salesman name
 * - Excludes cancelled visits unless mode=cancelled
 */
export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const mode = searchParams.get("mode") ?? "booked"; // "booked" or "scheduled"
  const salesman = searchParams.get("salesman");

  if (!from || !to) {
    return Response.json({ error: "Missing required params: from, to" }, { status: 400 });
  }

  const key = cacheKey("site-visit-list", { from, to, mode, salesman: salesman ?? undefined });
  const data = await cached(key, TTL.SHORT, async () => {
    const dateField = mode === "booked"
      ? "date_that_initial_visit_booked_is_set_to_yes"
      : "initial_home_visit_date";

    let after: string | undefined;
    let pages = 0;
    const MAX_PAGES = 40;
    const allContacts: {
      id: string;
      name: string;
      email: string;
      phone: string;
      source: string;
      visitDate: string;
      salesman: string;
      status: string;
    }[] = [];

    do {
      const filters: Record<string, unknown>[] = [
        { propertyName: dateField, operator: "GTE", value: dayStartUtcMs(from).toString() },
        { propertyName: dateField, operator: "LTE", value: dayEndUtcMs(to).toString() },
        { propertyName: "initial_visit_booked_", operator: "NEQ", value: "Cancelled" },
        LIFECYCLE_EXCLUSION_FILTER,
      ];
      if (salesman) {
        filters.push({ propertyName: "salesman", operator: "EQ", value: salesman });
      }

      const body: Record<string, unknown> = {
        filterGroups: [{ filters }],
        properties: [
          "firstname", "lastname", "email", "phone", "mobilephone",
          "original_lead_source", "initial_home_visit_date",
          "date_that_initial_visit_booked_is_set_to_yes",
          "salesman", "initial_visit_booked_",
        ],
        limit: 100,
        sorts: [{ propertyName: dateField, direction: "DESCENDING" }],
      };
      if (after) body.after = after;

      const result = await hubspotSearch(token, body);
      for (const c of result.results ?? []) {
        allContacts.push({
          id: c.id,
          name: [c.properties?.firstname, c.properties?.lastname].filter(Boolean).join(" ") || "Unknown",
          email: c.properties?.email ?? "",
          phone: c.properties?.phone || c.properties?.mobilephone || "",
          source: c.properties?.original_lead_source ?? "",
          visitDate: c.properties?.initial_home_visit_date ?? "",
          salesman: c.properties?.salesman ?? "",
          status: c.properties?.initial_visit_booked_ ?? "",
        });
      }

      after = result.paging?.next?.after;
      pages++;
      if (pages >= MAX_PAGES) break;
    } while (after);

    return { contacts: allContacts };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
