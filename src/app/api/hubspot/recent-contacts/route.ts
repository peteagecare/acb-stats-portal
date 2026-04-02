import { NextRequest } from "next/server";

const HUBSPOT_API = "https://api.hubapi.com";

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const body = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: "conversion_action",
            operator: "HAS_PROPERTY",
          },
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

  const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: err }, { status: res.status });
  }

  const data = await res.json();

  const contacts = (data.results ?? []).map(
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

  return Response.json({ contacts });
}
