import { NextRequest } from "next/server";
import { londonDateToUtcMs, hubspotFetch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

/**
 * Count of deals that ENTERED the "Stage 2 - Quote & Design Sent" deal stage
 * inside the period. The stage ID is resolved at runtime by walking the deal
 * pipelines and matching on the stage label, then cached.
 *
 * Date filter uses HubSpot's auto-maintained `hs_v2_date_entered_<stageId>`
 * timestamp on each deal — fires whenever a deal moves INTO that stage.
 */

const TARGET_LABEL = "stage 2 - quote & design sent";

async function resolveStageId(token: string): Promise<string> {
  return cached("deal-stage:quote-design-sent", TTL.VERY_LONG, async () => {
    const data = await hubspotFetch("/crm/v3/pipelines/deals", token);
    const pipelines = (data as { results?: { id: string; stages?: { id: string; label: string }[] }[] }).results ?? [];

    for (const p of pipelines) {
      for (const s of p.stages ?? []) {
        if ((s.label ?? "").trim().toLowerCase() === TARGET_LABEL) return s.id;
      }
    }
    for (const p of pipelines) {
      for (const s of p.stages ?? []) {
        if (/quote.*design.*sent|design.*quote.*sent/i.test(s.label ?? "")) return s.id;
      }
    }
    throw new Error(
      "Could not resolve a deal stage labelled like 'Stage 2 - Quote & Design Sent'",
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

  const key = cacheKey("quotes-sent", { from, to });
  try {
    const data = await cached(key, TTL.SHORT, async () => {
      const stageId = await resolveStageId(token);
      const dateProp = `hs_v2_date_entered_${stageId}`;
      const fromMs = londonDateToUtcMs(from, "00:00:00");
      const toMs = londonDateToUtcMs(to, "23:59:59");

      const body = {
        filterGroups: [
          {
            filters: [
              { propertyName: dateProp, operator: "GTE", value: fromMs.toString() },
              { propertyName: dateProp, operator: "LTE", value: toMs.toString() },
            ],
          },
        ],
        properties: [dateProp],
        limit: 1,
      };

      const result = await hubspotFetch("/crm/v3/objects/deals/search", token, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const total = (result as { total?: number }).total ?? 0;
      return { total, stageIdUsed: stageId };
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
