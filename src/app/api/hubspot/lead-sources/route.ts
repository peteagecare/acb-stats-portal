import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotFetch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

async function countContacts(
  token: string,
  fromMs: number,
  toMs: number,
  sourceFilter:
    | { operator: "EQ"; value: string }
    | { operator: "NOT_HAS_PROPERTY" }
): Promise<number> {
  const filters = [
    { propertyName: "createdate", operator: "GTE", value: fromMs.toString() },
    { propertyName: "createdate", operator: "LTE", value: toMs.toString() },
    { propertyName: "conversion_action", operator: "HAS_PROPERTY" },
    { propertyName: "original_lead_source", ...sourceFilter },
    LIFECYCLE_EXCLUSION_FILTER,
  ];

  const data = await hubspotFetch("/crm/v3/objects/contacts/search", token, {
    method: "POST",
    body: JSON.stringify({ filterGroups: [{ filters }], properties: ["original_lead_source"], limit: 1 }),
  });

  return (data as { total?: number }).total ?? 0;
}

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return Response.json({ error: "Missing required params: from, to" }, { status: 400 });

  const key = cacheKey("lead-sources", { from, to });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    const propData = await hubspotFetch("/crm/v3/properties/contacts/original_lead_source", token);
    const options: { value: string; label: string }[] = (propData as { options?: { value: string; label: string }[] }).options ?? [];

    // Fire all queries in parallel — HubSpot allows 100 req/10s, we're well under that
    const allQueries: Array<{ operator: "EQ"; value: string } | { operator: "NOT_HAS_PROPERTY" }> = [
      { operator: "NOT_HAS_PROPERTY" },
      ...options.map((opt) => ({ operator: "EQ" as const, value: opt.value })),
    ];

    const allCounts = await Promise.all(
      allQueries.map((q) => countContacts(token, fromMs, toMs, q))
    );

    const noValueCount = allCounts[0];
    const counts = allCounts.slice(1);

    const sources = [
      { label: "(No value)", value: "__no_value__", count: noValueCount },
      ...options.map((opt, i) => ({ label: opt.label, value: opt.value, count: counts[i] })),
    ];

    return { sources };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
