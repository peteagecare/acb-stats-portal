import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { londonDateToUtcMs, hubspotSearch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const source = searchParams.get("source");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!source || !from || !to) {
    return Response.json(
      { error: "Missing required params: source, from, to" },
      { status: 400 }
    );
  }

  const key = cacheKey("contacts", { source, from, to });
  const data = await cached(key, TTL.MEDIUM, async () => {
    const fromMs = londonDateToUtcMs(from, "00:00:00");
    const toMs = londonDateToUtcMs(to, "23:59:59");

    const filters = [
      {
        propertyName: "original_lead_source",
        operator: "EQ",
        value: source,
      },
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
        operator: "HAS_PROPERTY",
      },
      LIFECYCLE_EXCLUSION_FILTER,
    ];

    const body = {
      filterGroups: [{ filters }],
      properties: ["firstname", "lastname", "email", "createdate", "original_lead_source"],
      limit: 1,
    };

    const result = await hubspotSearch(token, body);
    return { total: result.total ?? 0 };
  });

  const isPast = to < new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": isPast ? "private, max-age=3600" : "private, max-age=300",
    },
  });
}
