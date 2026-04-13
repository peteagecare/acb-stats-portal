import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch, hubspotFetch, PROSPECT_ACTIONS, LEAD_ACTIONS, SOURCE_CATEGORIES, getSourceCategory } from "@/lib/hubspot";
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

    // Get source options
    const propData = await hubspotFetch(
      "/crm/v3/properties/contacts/original_lead_source",
      token,
    );
    const options: { value: string }[] = (propData as { options?: { value: string }[] }).options ?? [];

    // Group sources by category
    const categorySourceValues: Record<string, string[]> = { PPC: [], SEO: [], Content: [], Other: [] };
    for (const opt of options) {
      categorySourceValues[getSourceCategory(opt.value)].push(opt.value);
    }

    const results: Record<string, { prospects: number; leads: number }> = {
      PPC: { prospects: 0, leads: 0 },
      SEO: { prospects: 0, leads: 0 },
      Content: { prospects: 0, leads: 0 },
      Other: { prospects: 0, leads: 0 },
    };

    const dateFilters = [
      { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
      { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
      LIFECYCLE_EXCLUSION_FILTER,
    ];

    // 8 queries total: 4 categories x 2 types (prospect/lead)
    // Run them one at a time with delays to avoid rate limits
    for (const cat of ["PPC", "SEO", "Content", "Other"] as const) {
      const sourceValues = categorySourceValues[cat];
      if (sourceValues.length === 0) continue;

      // Prospects for this category
      const prospectResult = await hubspotSearch(token, {
        filterGroups: [{ filters: [
          ...dateFilters,
          { propertyName: "original_lead_source", operator: "IN", values: sourceValues },
          { propertyName: "conversion_action", operator: "IN", values: PROSPECT_ACTIONS },
        ] }],
        properties: ["conversion_action"],
        limit: 1,
      });
      results[cat].prospects = prospectResult.total ?? 0;

      await new Promise((r) => setTimeout(r, 500));

      // Leads for this category
      const leadResult = await hubspotSearch(token, {
        filterGroups: [{ filters: [
          ...dateFilters,
          { propertyName: "original_lead_source", operator: "IN", values: sourceValues },
          { propertyName: "conversion_action", operator: "IN", values: LEAD_ACTIONS },
        ] }],
        properties: ["conversion_action"],
        limit: 1,
      });
      results[cat].leads = leadResult.total ?? 0;

      await new Promise((r) => setTimeout(r, 500));
    }

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
