import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch, fetchPropertyLabels } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

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

  const key = cacheKey("home-visit-breakdown", { from, to });
  const data = await cached(key, TTL.SHORT, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    const byAction = new Map<string, number>();
    const bySource = new Map<string, number>();
    let total = 0;

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

      const result = await hubspotSearch(token, body);
      for (const c of result.results ?? []) {
        total += 1;
        const action = c.properties?.conversion_action ?? "__none__";
        const source = c.properties?.original_lead_source ?? "__none__";
        byAction.set(action, (byAction.get(action) ?? 0) + 1);
        bySource.set(source, (bySource.get(source) ?? 0) + 1);
      }

      after = result.paging?.next?.after;
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

    return {
      total,
      byAction: serialise(byAction, actionLabels, "Direct booking (no form)"),
      bySource: serialise(bySource, sourceLabels, "(No source)"),
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
