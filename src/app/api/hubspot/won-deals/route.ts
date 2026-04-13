import { NextRequest } from "next/server";
import { londonDateToUtcMs, hubspotFetch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

// Won-Waiting lifecycle stage value
const WON_WAITING_STAGE = "151694551";
// Completed lifecycle stage value
const COMPLETED_STAGE = "151694559";

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return Response.json({ error: "Missing required params: from, to" }, { status: 400 });

  const key = cacheKey("won-deals", { from, to });
  const data = await cached(key, TTL.LONG, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    // Count contacts whose deal was created in the date range AND are in Won-Waiting or Completed stage
    // Using first_deal_created_date as the date the deal was won
    const stages = [WON_WAITING_STAGE, COMPLETED_STAGE];
    let total = 0;
    let totalValue = 0;
    const bySource = new Map<string, { count: number; value: number }>();

    for (const stage of stages) {
      const body = {
        filterGroups: [{
          filters: [
            { propertyName: "lifecyclestage", operator: "EQ", value: stage },
            { propertyName: "first_deal_created_date", operator: "GTE", value: fromMs.toString() },
            { propertyName: "first_deal_created_date", operator: "LTE", value: toMs.toString() },
          ],
        }],
        properties: ["lifecyclestage", "recent_deal_amount", "first_deal_created_date", "original_lead_source"],
        limit: 100,
      };

      const result = await hubspotFetch("/crm/v3/objects/contacts/search", token, {
        method: "POST",
        body: JSON.stringify(body),
      });

      total += (result as { total?: number }).total ?? 0;

      for (const contact of (result as { results?: { properties?: Record<string, string> }[] }).results ?? []) {
        const amt = parseFloat(contact.properties?.recent_deal_amount ?? "0");
        if (!isNaN(amt)) totalValue += amt;

        const source = contact.properties?.original_lead_source ?? "(No source)";
        const entry = bySource.get(source) ?? { count: 0, value: 0 };
        entry.count += 1;
        if (!isNaN(amt)) entry.value += amt;
        bySource.set(source, entry);
      }
    }

    const sourceList = Array.from(bySource.entries())
      .map(([label, d]) => ({ label, count: d.count, value: Math.round(d.value) }))
      .sort((a, b) => b.count - a.count);

    return { total, totalValue: Math.round(totalValue), bySource: sourceList };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
