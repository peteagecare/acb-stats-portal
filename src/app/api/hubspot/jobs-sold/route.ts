import { NextRequest } from "next/server";
import { londonDateToUtcMs, hubspotFetch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

/**
 * Deals that ENTERED the "Won - Awaiting Install" deal stage inside the
 * period. Returns count, total deal value, and average deal value.
 *
 * Stage ID is resolved at runtime by walking deal pipelines and matching on
 * stage label, then cached. Date filter uses HubSpot's auto-maintained
 * `hs_v2_date_entered_<stageId>` timestamp on each deal.
 */

const TARGET_LABEL = "won - awaiting install";

async function resolveStageId(token: string): Promise<string> {
  return cached("deal-stage:won-awaiting-install", TTL.VERY_LONG, async () => {
    const data = await hubspotFetch("/crm/v3/pipelines/deals", token);
    const pipelines = (data as { results?: { id: string; stages?: { id: string; label: string }[] }[] }).results ?? [];

    for (const p of pipelines) {
      for (const s of p.stages ?? []) {
        if ((s.label ?? "").trim().toLowerCase() === TARGET_LABEL) return s.id;
      }
    }
    for (const p of pipelines) {
      for (const s of p.stages ?? []) {
        if (/won.*awaiting.*install|awaiting.*install/i.test(s.label ?? "")) return s.id;
      }
    }
    throw new Error(
      `Looking for deal stage "${TARGET_LABEL}" — not found in any pipeline.`,
    );
  });
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

  const key = cacheKey("jobs-sold-v2", { from, to });
  try {
    const data = await cached(key, TTL.SHORT, async () => {
      const stageId = await resolveStageId(token);
      const dateProp = `hs_v2_date_entered_${stageId}`;
      const fromMs = londonDateToUtcMs(from, "00:00:00");
      const toMs = londonDateToUtcMs(to, "23:59:59");

      let total = 0;
      let totalValue = 0;
      let after: string | undefined;
      let pages = 0;
      const MAX_PAGES = 50;
      const debugDeals: { id: string; name: string; amount: string | null; amountHome: string | null }[] = [];

      do {
        const body: Record<string, unknown> = {
          filterGroups: [
            {
              filters: [
                { propertyName: dateProp, operator: "GTE", value: fromMs.toString() },
                { propertyName: dateProp, operator: "LTE", value: toMs.toString() },
              ],
            },
          ],
          properties: ["amount", "amount_in_home_currency", "dealname", dateProp],
          limit: 100,
          sorts: [{ propertyName: dateProp, direction: "ASCENDING" }],
        };
        if (after) body.after = after;

        const result = (await hubspotFetch("/crm/v3/objects/deals/search", token, {
          method: "POST",
          body: JSON.stringify(body),
        })) as {
          total?: number;
          results?: { id: string; properties?: Record<string, string | null> }[];
          paging?: { next?: { after: string } };
        };

        if (pages === 0 && typeof result.total === "number") total = result.total;

        for (const d of result.results ?? []) {
          const rawAmount = d.properties?.amount ?? null;
          const rawAmountHome = d.properties?.amount_in_home_currency ?? null;
          const amt = parseFloat(rawAmount ?? "");
          const amtHome = parseFloat(rawAmountHome ?? "");
          if (Number.isFinite(amt) && amt > 0) totalValue += amt;
          else if (Number.isFinite(amtHome) && amtHome > 0) totalValue += amtHome;
          if (debugDeals.length < 10) {
            debugDeals.push({
              id: d.id,
              name: d.properties?.dealname ?? "(no name)",
              amount: rawAmount,
              amountHome: rawAmountHome,
            });
          }
        }

        after = result.paging?.next?.after;
        pages++;
        if (pages >= MAX_PAGES) break;
      } while (after);

      const avgValue = total > 0 ? totalValue / total : 0;
      return {
        total,
        totalValue: Math.round(totalValue),
        avgValue: Math.round(avgValue),
        debug: { sampleDeals: debugDeals },
      };
    });

    const isPast = to < new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
