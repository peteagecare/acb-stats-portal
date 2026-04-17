import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER, EXCLUDED_LIFECYCLE_STAGES } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch, fetchPropertyLabels, PROSPECT_ACTIONS_SET, LEAD_ACTIONS_SET } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

/**
 * Per-day breakdown of lead source + conversion action for contacts
 * created in the given range. Used by the Trends chart tooltip.
 *
 * Returns: { days: { [YYYY-MM-DD]: { sources: {label,count}[], actions: {label,count}[] } } }
 */

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return Response.json({ error: "Missing from/to" }, { status: 400 });

  const key = cacheKey("daily-breakdown", { from, to });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    const sourceLabelsPromise = fetchPropertyLabels(token, "original_lead_source");
    const actionLabelsPromise = fetchPropertyLabels(token, "conversion_action");

    // Fetch all contacts in range
    const contacts: { properties: Record<string, string | null> }[] = [];
    let after: string | undefined;
    const MAX_PAGES = 80;

    for (let page = 0; page < MAX_PAGES; page++) {
      const body: Record<string, unknown> = {
        filterGroups: [{
          filters: [
            { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
            { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
            { propertyName: "conversion_action", operator: "HAS_PROPERTY" },
            LIFECYCLE_EXCLUSION_FILTER,
          ],
        }],
        properties: ["createdate", "original_lead_source", "conversion_action", "lifecyclestage"],
        limit: 100,
        sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
        ...(after ? { after } : {}),
      };

      const result = await hubspotSearch(token, body);
      contacts.push(...result.results.map((r) => ({ properties: r.properties })));
      after = result.paging?.next?.after;
      if (!after || result.results.length < 100) break;
      if ((page + 1) % 3 === 0) await new Promise((r) => setTimeout(r, 1500));
    }

    const sourceLabels = await sourceLabelsPromise;
    const actionLabels = await actionLabelsPromise;

    // Group by date
    const days: Record<string, {
      sources: Record<string, number>;
      actions: Record<string, number>;
      // Per-metric breakdowns
      prospectSources: Record<string, number>;
      prospectActions: Record<string, number>;
      leadSources: Record<string, number>;
      leadActions: Record<string, number>;
    }> = {};

    for (const c of contacts) {
      const stage = c.properties.lifecyclestage ?? "";
      if (EXCLUDED_LIFECYCLE_STAGES.includes(stage)) continue;

      const createDate = c.properties.createdate;
      if (!createDate) continue;
      // Convert to London date
      const d = new Date(createDate);
      const londonDate = d.toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // YYYY-MM-DD

      if (!days[londonDate]) {
        days[londonDate] = { sources: {}, actions: {}, prospectSources: {}, prospectActions: {}, leadSources: {}, leadActions: {} };
      }
      const day = days[londonDate];

      const sourceKey = c.properties.original_lead_source || "__no_value__";
      const sourceLabel = sourceKey === "__no_value__" ? "(No source)" : (sourceLabels[sourceKey] ?? sourceKey);
      const actionKey = c.properties.conversion_action || "";
      const actionLabel = actionLabels[actionKey] ?? actionKey;

      // All contacts
      day.sources[sourceLabel] = (day.sources[sourceLabel] ?? 0) + 1;
      if (actionLabel) day.actions[actionLabel] = (day.actions[actionLabel] ?? 0) + 1;

      // Prospects
      if (PROSPECT_ACTIONS_SET.has(actionKey)) {
        day.prospectSources[sourceLabel] = (day.prospectSources[sourceLabel] ?? 0) + 1;
        if (actionLabel) day.prospectActions[actionLabel] = (day.prospectActions[actionLabel] ?? 0) + 1;
      }

      // Leads
      if (LEAD_ACTIONS_SET.has(actionKey)) {
        day.leadSources[sourceLabel] = (day.leadSources[sourceLabel] ?? 0) + 1;
        if (actionLabel) day.leadActions[actionLabel] = (day.leadActions[actionLabel] ?? 0) + 1;
      }
    }

    // Convert to sorted arrays
    const result: Record<string, {
      sources: { label: string; count: number }[];
      actions: { label: string; count: number }[];
      prospectSources: { label: string; count: number }[];
      prospectActions: { label: string; count: number }[];
      leadSources: { label: string; count: number }[];
      leadActions: { label: string; count: number }[];
    }> = {};

    for (const [date, day] of Object.entries(days)) {
      const toSorted = (map: Record<string, number>) =>
        Object.entries(map).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

      result[date] = {
        sources: toSorted(day.sources),
        actions: toSorted(day.actions),
        prospectSources: toSorted(day.prospectSources),
        prospectActions: toSorted(day.prospectActions),
        leadSources: toSorted(day.leadSources),
        leadActions: toSorted(day.leadActions),
      };
    }

    return { days: result };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
