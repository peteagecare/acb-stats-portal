import { NextRequest } from "next/server";
import { hubspotSearch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const key = cacheKey("pipeline-value", {});
  const data = await cached(key, TTL.LONG, async () => {
    const body = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "lifecyclestage",
              operator: "EQ",
              value: "151694551",
            },
          ],
        },
      ],
      properties: ["lifecyclestage"],
      limit: 1,
    };

    const result = await hubspotSearch(token, body);
    return { count: result.total ?? 0 };
  });

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=300",
    },
  });
}
