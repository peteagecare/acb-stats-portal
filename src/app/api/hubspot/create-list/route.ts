import { NextRequest } from "next/server";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

// HubSpot CRM Lists v3 — create a static (MANUAL) contact list and add members.
// Docs: https://developers.hubspot.com/docs/reference/api/crm/lists

const HUB_ID = "25733939";

// Direct fetch (not hubspotFetch) so we can inspect raw status/text for better errors
// and handle empty 2xx bodies, which hubspotFetch's JSON-only contract doesn't.
async function hsCall(path: string, token: string, init: RequestInit): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try { json = JSON.parse(text); } catch { /* non-json body */ }
  }
  return { ok: res.ok, status: res.status, json, text };
}

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const user = parseSessionToken(sessionToken);
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!token) {
      return Response.json({ error: "HUBSPOT_ACCESS_TOKEN not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => null) as { name?: string; contactIds?: string[] } | null;
    const name = body?.name?.trim();
    const contactIds = Array.isArray(body?.contactIds) ? body!.contactIds.filter(Boolean) : [];

    if (!name) return Response.json({ error: "name is required" }, { status: 400 });
    if (contactIds.length === 0) return Response.json({ error: "contactIds are required" }, { status: 400 });

    // 1. Create the list (MANUAL = static)
    const createRes = await hsCall("/crm/v3/lists", token, {
      method: "POST",
      body: JSON.stringify({ name, objectTypeId: "0-1", processingType: "MANUAL" }),
    });
    if (!createRes.ok) {
      return Response.json({ error: `HubSpot create-list failed (${createRes.status})`, detail: createRes.json ?? createRes.text }, { status: 502 });
    }
    const listId = (createRes.json as { list?: { listId?: string } } | null)?.list?.listId;
    if (!listId) {
      return Response.json({ error: "HubSpot did not return a listId", detail: createRes.json ?? createRes.text }, { status: 502 });
    }

    // 2. Add contacts in batches of 10000 (API limit).
    const BATCH = 10000;
    for (let i = 0; i < contactIds.length; i += BATCH) {
      const chunk = contactIds.slice(i, i + BATCH);
      const addRes = await hsCall(`/crm/v3/lists/${listId}/memberships/add`, token, {
        method: "PUT",
        body: JSON.stringify(chunk),
      });
      if (!addRes.ok) {
        return Response.json({ error: `HubSpot add-members failed (${addRes.status})`, detail: addRes.json ?? addRes.text, listId }, { status: 502 });
      }
    }

    return Response.json({
      listId,
      url: `https://app-eu1.hubspot.com/contacts/${HUB_ID}/objectLists/${listId}`,
      added: contactIds.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("create-list route error:", e);
    return Response.json({ error: message }, { status: 500 });
  }
}
