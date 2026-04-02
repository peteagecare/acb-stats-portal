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

  return Response.json({ count: data.total ?? 0 });
}
