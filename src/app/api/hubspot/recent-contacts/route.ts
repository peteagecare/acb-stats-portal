import { NextRequest } from "next/server";
import { LIFECYCLE_EXCLUSION_FILTER } from "@/lib/hubspot-exclusions";
import { hubspotSearch } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const key = cacheKey("recent-contacts", {});
  const data = await cached(key, TTL.SHORT, async () => {
    const body = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "conversion_action",
              operator: "HAS_PROPERTY",
            },
            LIFECYCLE_EXCLUSION_FILTER,
          ],
        },
      ],
      properties: [
        "firstname",
        "lastname",
        "email",
        "createdate",
        "conversion_action",
        "original_lead_source",
        "lifecyclestage",
      ],
      sorts: [
        {
          propertyName: "createdate",
          direction: "DESCENDING",
        },
      ],
      limit: 10,
    };

    const result = await hubspotSearch(token, body);

    const contacts = (result.results ?? []).map(
      (c: { properties: Record<string, string | null> }) => ({
        name: [c.properties.firstname, c.properties.lastname]
          .filter(Boolean)
          .join(" ") || "Unknown",
        email: c.properties.email ?? "",
        date: c.properties.createdate ?? "",
        action: c.properties.conversion_action ?? "",
        source: c.properties.original_lead_source ?? "",
        stage: c.properties.lifecyclestage ?? "",
      })
    );

    return { contacts };
  });

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=300",
    },
  });
}
