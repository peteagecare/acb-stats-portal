import { NextRequest } from "next/server";
import { EXCLUDED_LIFECYCLE_STAGES } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotFetch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

async function countByStageInPeriod(token: string, stage: string, fromMs: number, toMs: number): Promise<number> {
  const body = {
    filterGroups: [{
      filters: [
        { propertyName: "lifecyclestage", operator: "EQ", value: stage },
        { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
        { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
      ],
    }],
    properties: ["lifecyclestage"],
    limit: 1,
  };
  const data = await hubspotFetch("/crm/v3/objects/contacts/search", token, { method: "POST", body: JSON.stringify(body) });
  return (data as { total?: number }).total ?? 0;
}

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return Response.json({ error: "Missing required params: from, to" }, { status: 400 });

  const key = cacheKey("lifecycle-stages-period", { from, to });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    const propData = await hubspotFetch("/crm/v3/properties/contacts/lifecyclestage", token);
    const allOptions: { value: string; label: string; displayOrder: number }[] =
      (propData as { options?: { value: string; label: string; displayOrder: number }[] }).options ?? [];
    const options = allOptions.filter((o) => !EXCLUDED_LIFECYCLE_STAGES.includes(o.value));

    // Batch stage counts 8 at a time to avoid HubSpot rate limits
    const BATCH = 8;
    const counts: number[] = [];
    for (let i = 0; i < options.length; i += BATCH) {
      const results = await Promise.all(
        options.slice(i, i + BATCH).map((opt) => countByStageInPeriod(token, opt.value, fromMs, toMs))
      );
      counts.push(...results);
    }

    const stages = options
      .map((opt, i) => ({ label: opt.label, value: opt.value, count: counts[i], order: opt.displayOrder }))
      .sort((a, b) => a.order - b.order);

    return { stages };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
