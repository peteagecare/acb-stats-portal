import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch, hubspotFetch, PROSPECT_ACTIONS, LEAD_ACTIONS, getSourceCategory } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return Response.json({ error: "Missing required params: from, to" }, { status: 400 });

  const key = cacheKey("source-breakdown", { from, to });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    const propData = await hubspotFetch("/crm/v3/properties/contacts/original_lead_source", token);
    const options: { value: string }[] = (propData as { options?: { value: string }[] }).options ?? [];

    const categorySourceValues: Record<string, string[]> = { PPC: [], SEO: [], Content: [], TV: [], Other: [] };
    for (const opt of options) {
      const cat = getSourceCategory(opt.value);
      if (!categorySourceValues[cat]) categorySourceValues[cat] = [];
      categorySourceValues[cat].push(opt.value);
    }

    const results: Record<string, { prospects: number; leads: number }> = {
      PPC: { prospects: 0, leads: 0 },
      SEO: { prospects: 0, leads: 0 },
      Content: { prospects: 0, leads: 0 },
      TV: { prospects: 0, leads: 0 },
      Other: { prospects: 0, leads: 0 },
    };

    const dateFilters = [
      { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
      { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
      LIFECYCLE_EXCLUSION_FILTER,
    ];

    // Fire queries in parallel (5 categories × 2 types)
    const categories = ["PPC", "SEO", "Content", "TV", "Other"] as const;
    const queries = categories.flatMap((cat) => {
      const sourceValues = categorySourceValues[cat];
      if (sourceValues.length === 0) return [];
      const sourceFilter = { propertyName: "original_lead_source", operator: "IN", values: sourceValues };
      return [
        { cat, type: "prospects" as const, body: { filterGroups: [{ filters: [...dateFilters, sourceFilter, { propertyName: "conversion_action", operator: "IN", values: PROSPECT_ACTIONS }] }], properties: ["conversion_action"], limit: 1 } },
        { cat, type: "leads" as const, body: { filterGroups: [{ filters: [...dateFilters, sourceFilter, { propertyName: "conversion_action", operator: "IN", values: LEAD_ACTIONS }] }], properties: ["conversion_action"], limit: 1 } },
      ];
    });

    const counts = await Promise.all(
      queries.map((q) => hubspotSearch(token, q.body).then((r) => r.total ?? 0))
    );

    queries.forEach((q, i) => {
      results[q.cat][q.type] = counts[i];
    });

    return { breakdown: results };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
