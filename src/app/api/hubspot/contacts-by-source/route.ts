import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch, hubspotFetch, getSourceCategory } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

const CATEGORIES = ["PPC", "SEO", "Content", "TV", "Other"] as const;
type Category = (typeof CATEGORIES)[number];

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return Response.json({ error: "Missing required params: from, to" }, { status: 400 });

  const key = cacheKey("contacts-by-source-v2", { from, to });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    const propData = await hubspotFetch("/crm/v3/properties/contacts/original_lead_source", token);
    const options: { value: string; label?: string }[] = (propData as { options?: { value: string; label?: string }[] }).options ?? [];

    const dateFilters = [
      { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
      { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
      LIFECYCLE_EXCLUSION_FILTER,
    ];

    const BATCH = 3;
    const counts: number[] = [];
    for (let i = 0; i < options.length; i += BATCH) {
      if (i > 0) await new Promise((r) => setTimeout(r, 400));
      const batch = options.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((opt) =>
          hubspotSearch(token, {
            filterGroups: [{
              filters: [
                ...dateFilters,
                { propertyName: "original_lead_source", operator: "EQ", value: opt.value },
              ],
            }],
            properties: ["original_lead_source"],
            limit: 1,
          })
            .then((r) => r.total ?? 0)
            .catch(() => 0)
        )
      );
      counts.push(...results);
    }

    const byCategory: Record<Category, { total: number; sources: { value: string; label: string; count: number }[] }> = {
      PPC: { total: 0, sources: [] },
      SEO: { total: 0, sources: [] },
      Content: { total: 0, sources: [] },
      TV: { total: 0, sources: [] },
      Other: { total: 0, sources: [] },
    };

    options.forEach((opt, i) => {
      const cat = getSourceCategory(opt.value) as Category;
      const count = counts[i];
      byCategory[cat].total += count;
      byCategory[cat].sources.push({ value: opt.value, label: opt.label ?? opt.value, count });
    });

    for (const cat of CATEGORIES) {
      byCategory[cat].sources.sort((a, b) => b.count - a.count);
    }

    return { byCategory };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
