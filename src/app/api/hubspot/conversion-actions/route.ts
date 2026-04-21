import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotFetch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

async function countContacts(
  token: string,
  fromMs: number,
  toMs: number,
  actionFilter:
    | { operator: "EQ"; value: string }
    | { operator: "NOT_HAS_PROPERTY" },
  sourceValues?: string[]
): Promise<number> {
  const filters: object[] = [
    { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
    { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
    { propertyName: "conversion_action", ...actionFilter },
    LIFECYCLE_EXCLUSION_FILTER,
  ];
  if (sourceValues && sourceValues.length > 0) {
    filters.push({ propertyName: "original_lead_source", operator: "IN", values: sourceValues });
  }

  const data = await hubspotFetch("/crm/v3/objects/contacts/search", token, {
    method: "POST",
    body: JSON.stringify({ filterGroups: [{ filters }], properties: ["conversion_action"], limit: 1 }),
  });

  return (data as { total?: number }).total ?? 0;
}

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const sourcesParam = searchParams.get("sources");
  if (!from || !to) return Response.json({ error: "Missing required params: from, to" }, { status: 400 });

  const sourceValues = sourcesParam ? sourcesParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  const sourcesKey = sourceValues && sourceValues.length > 0 ? [...sourceValues].sort().join("|") : "";

  const key = cacheKey("conversion-actions", { from, to, sources: sourcesKey });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    const propData = await hubspotFetch("/crm/v3/properties/contacts/conversion_action", token);
    const options: { value: string; label: string }[] = (propData as { options?: { value: string; label: string }[] }).options ?? [];

    const BATCH = 4;
    const allCounts: number[] = [];
    for (let i = 0; i < options.length; i += BATCH) {
      if (i > 0) await new Promise((r) => setTimeout(r, 250));
      const results = await Promise.all(
        options.slice(i, i + BATCH).map((opt) => countContacts(token, fromMs, toMs, { operator: "EQ", value: opt.value }, sourceValues))
      );
      allCounts.push(...results);
    }

    const actions = options.map((opt, i) => ({ label: opt.label, value: opt.value, count: allCounts[i] }));

    return { actions };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
