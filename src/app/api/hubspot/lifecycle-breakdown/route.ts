import { hubspotSearch, hubspotFetch, fetchPropertyLabels } from "@/lib/hubspot";
import { EXCLUDED_LIFECYCLE_STAGES } from "@/lib/hubspot-exclusions";
import { cached, cacheKey, TTL } from "@/lib/cache";

/**
 * Per-lifecycle-stage breakdown of lead source + conversion action.
 * Queries each stage individually to avoid HubSpot's 10k search limit.
 */

async function fetchStageBreakdown(
  token: string,
  stageValue: string,
  sourceLabels: Record<string, string>,
  actionLabels: Record<string, string>,
): Promise<{ sources: { label: string; count: number }[]; actions: { label: string; count: number }[] }> {
  const contacts: { properties: Record<string, string | null> }[] = [];
  let after: string | undefined;
  const MAX_PAGES = 100; // 10k per stage max

  for (let page = 0; page < MAX_PAGES; page++) {
    const body: Record<string, unknown> = {
      filterGroups: [{
        filters: [{ propertyName: "lifecyclestage", operator: "EQ", value: stageValue }],
      }],
      properties: ["original_lead_source", "conversion_action"],
      limit: 100,
      ...(after ? { after } : {}),
    };

    const result = await hubspotSearch(token, body);
    contacts.push(...result.results.map((r) => ({ properties: r.properties })));
    after = result.paging?.next?.after;
    if (!after || result.results.length < 100) break;
    if ((page + 1) % 3 === 0) await new Promise((r) => setTimeout(r, 1500));
  }

  const sources: Record<string, number> = {};
  const actions: Record<string, number> = {};

  for (const c of contacts) {
    const sourceKey = c.properties.original_lead_source || "__no_value__";
    const sourceLabel = sourceKey === "__no_value__" ? "(No source)" : (sourceLabels[sourceKey] ?? sourceKey);
    sources[sourceLabel] = (sources[sourceLabel] ?? 0) + 1;

    const actionKey = c.properties.conversion_action || "__no_value__";
    const actionLabel = actionKey === "__no_value__" ? "(No action)" : (actionLabels[actionKey] ?? actionKey);
    actions[actionLabel] = (actions[actionLabel] ?? 0) + 1;
  }

  const toSorted = (map: Record<string, number>) =>
    Object.entries(map).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  return { sources: toSorted(sources), actions: toSorted(actions) };
}

export async function GET() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const key = cacheKey("lifecycle-breakdown", {});
  const data = await cached(key, TTL.LONG, async () => {
    // Get all lifecycle stage options
    const propData = await hubspotFetch("/crm/v3/properties/contacts/lifecyclestage", token);
    const allOptions = (propData.options as { value: string; label: string }[]) ?? [];
    const options = allOptions.filter((o) => !EXCLUDED_LIFECYCLE_STAGES.includes(o.value));
    console.log("[lifecycle-breakdown] fetching breakdowns for", options.length, "stages:", options.map(o => `${o.value}=${o.label}`));

    const [sourceLabels, actionLabels] = await Promise.all([
      fetchPropertyLabels(token, "original_lead_source"),
      fetchPropertyLabels(token, "conversion_action"),
    ]);

    // Fetch breakdowns per stage, 2 at a time to avoid rate limits
    const result: Record<string, { sources: { label: string; count: number }[]; actions: { label: string; count: number }[] }> = {};
    const BATCH = 2;

    for (let i = 0; i < options.length; i += BATCH) {
      if (i > 0) await new Promise((r) => setTimeout(r, 500));
      const batch = options.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((opt) => fetchStageBreakdown(token, opt.value, sourceLabels, actionLabels))
      );
      batch.forEach((opt, j) => {
        const srcTotal = results[j].sources.reduce((s, x) => s + x.count, 0);
        console.log(`[lifecycle-breakdown] ${opt.label} (${opt.value}): ${srcTotal} contacts`);
        result[opt.value] = results[j];
      });
    }

    return { stages: result };
  });

  return Response.json(data);
}
