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
    | { operator: "NOT_HAS_PROPERTY" }
): Promise<number> {
  const filters = [
    {
      propertyName: "createdate",
      operator: "GTE",
      value: fromMs.toString(),
    },
    {
      propertyName: "createdate",
      operator: "LTE",
      value: toMs.toString(),
    },
    {
      propertyName: "conversion_action",
      ...actionFilter,
    },
    LIFECYCLE_EXCLUSION_FILTER,
  ];

  const data = await hubspotFetch(
    "/crm/v3/objects/contacts/search",
    token,
    {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [{ filters }],
        properties: ["conversion_action"],
        limit: 1,
      }),
    }
  );

  return (data as { total?: number }).total ?? 0;
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

  const key = cacheKey("conversion-actions", { from, to });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    // Fetch property definition to get all conversion action options
    const propData = await hubspotFetch(
      "/crm/v3/properties/contacts/conversion_action",
      token
    );

    const options: { value: string; label: string }[] = (propData as { options?: { value: string; label: string }[] }).options ?? [];

    // Count contacts for each action, batched to avoid rate limits
    const allQueries: Array<
      | { operator: "EQ"; value: string }
      | { operator: "NOT_HAS_PROPERTY" }
    > = options.map((opt) => ({ operator: "EQ" as const, value: opt.value }));

    const BATCH_SIZE = 4;
    const allCounts: number[] = [];

    for (let i = 0; i < allQueries.length; i += BATCH_SIZE) {
      const batch = allQueries.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((q) => countContacts(token, fromMs, toMs, q))
      );
      allCounts.push(...results);
      if (i + BATCH_SIZE < allQueries.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    const actions = options.map((opt, i) => ({
      label: opt.label,
      value: opt.value,
      count: allCounts[i],
    }));

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
