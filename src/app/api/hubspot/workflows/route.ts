import { NextRequest } from "next/server";
import { HUBSPOT_API } from "@/lib/hubspot";
import { cached, cacheKey, TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing HUBSPOT_ACCESS_TOKEN" }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");

  // If an ID is provided, fetch a single workflow with full details
  if (id) {
    const key = cacheKey("workflows", { id });
    const data = await cached(key, TTL.LONG, async () => {
      const res = await fetch(`${HUBSPOT_API}/automation/v4/flows/${id}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`${res.status}: ${err}`);
      }

      return res.json();
    });

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=900",
      },
    });
  }

  // Otherwise list all workflows
  const key = cacheKey("workflows", {});
  const data = await cached(key, TTL.LONG, async () => {
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
        const resData = await res.json();
        return { ...resData, apiVersion: endpoint.version };
      }

      // If 401/403, try next endpoint
      if (res.status === 401 || res.status === 403) {
        continue;
      }

      // Other errors — throw
      const err = await res.text();
      throw new Error(`${res.status}: ${err} (apiVersion: ${endpoint.version})`);
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

    return {
      error: "Cannot access workflows API. Your HubSpot private app token likely needs the 'automation' scope enabled.",
      help: "Go to HubSpot → Settings → Integrations → Private Apps → your app → Scopes → enable 'automation' (under Standard scopes).",
      currentScopes: scopeInfo?.scopes ?? "Could not determine",
      tokenType: scopeInfo?.token_type ?? "unknown",
      _isScopeError: true,
    };
  });

  // If it was a scope error, return 403
  if (data && typeof data === "object" && "_isScopeError" in data) {
    const { _isScopeError, ...rest } = data as Record<string, unknown>;
    return Response.json(rest, { status: 403 });
  }

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=900",
    },
  });
}
