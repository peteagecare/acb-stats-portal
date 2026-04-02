import { NextRequest } from "next/server";

const HUBSPOT_API = "https://api.hubapi.com";

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");

  // If an ID is provided, fetch a single workflow with full details
  if (id) {
    const res = await fetch(`${HUBSPOT_API}/automation/v4/flows/${id}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err, status: res.status }, { status: res.status });
    }

    const data = await res.json();
    return Response.json(data);
  }

  // Otherwise list all workflows
  // Try v4 first, fall back to v3
  const endpoints = [
    { url: `${HUBSPOT_API}/automation/v4/flows?limit=500`, version: "v4" },
    { url: `${HUBSPOT_API}/automation/v3/workflows`, version: "v3" },
  ];

  for (const endpoint of endpoints) {
    const res = await fetch(endpoint.url, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      return Response.json({ ...data, apiVersion: endpoint.version });
    }

    // If 401/403, try next endpoint
    if (res.status === 401 || res.status === 403) {
      continue;
    }

    // Other errors — return them
    const err = await res.text();
    return Response.json(
      { error: err, status: res.status, apiVersion: endpoint.version },
      { status: res.status }
    );
  }

  // Both failed — check what scopes the token has
  const scopeRes = await fetch(
    `${HUBSPOT_API}/oauth/v1/access-tokens/${token}`,
    { cache: "no-store", headers: { Authorization: `Bearer ${token}` } }
  );

  let scopeInfo = null;
  if (scopeRes.ok) {
    scopeInfo = await scopeRes.json();
  }

  return Response.json({
    error: "Cannot access workflows API. Your HubSpot private app token likely needs the 'automation' scope enabled.",
    help: "Go to HubSpot → Settings → Integrations → Private Apps → your app → Scopes → enable 'automation' (under Standard scopes).",
    currentScopes: scopeInfo?.scopes ?? "Could not determine",
    tokenType: scopeInfo?.token_type ?? "unknown",
  }, { status: 403 });
}
