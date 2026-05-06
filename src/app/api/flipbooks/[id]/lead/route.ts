import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { flipbookLeads, flipbooks } from "@/db/schema";
import type { LeadField, LeadGate } from "@/lib/flipbook/types";
import { submitHubspotForm } from "@/lib/hubspot-forms";
import {
  LEAD_COOKIE_MAX_AGE_SECONDS,
  leadCookieName,
} from "@/lib/flipbook/lead-cookie";

export const runtime = "nodejs";

type SubmissionBody = { values?: Record<string, unknown> };

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/flipbooks/[id]/lead">,
): Promise<Response> {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(flipbooks)
    .where(eq(flipbooks.id, id))
    .limit(1);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  const gate = row.leadGate as LeadGate | null;
  if (!gate || !gate.enabled) {
    return Response.json({ error: "Lead capture not enabled" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as SubmissionBody | null;
  if (!body || !body.values || typeof body.values !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const cleaned: Record<string, string> = {};
  for (const field of gate.fields) {
    const raw = (body.values as Record<string, unknown>)[field.key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (field.required && value.length === 0) {
      return Response.json(
        { error: `${field.label} is required` },
        { status: 400 },
      );
    }
    if (value.length > 500) {
      return Response.json(
        { error: `${field.label} is too long` },
        { status: 400 },
      );
    }
    if (field.type === "email" && value.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return Response.json(
        { error: `${field.label} must be a valid email` },
        { status: 400 },
      );
    }
    cleaned[field.key] = value;
  }

  const cookieId = nanoid(24);
  const emailField = gate.fields.find((f) => f.type === "email");
  const email = emailField ? cleaned[emailField.key] || null : null;
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent") || null;

  let hubspotSubmittedAt: Date | null = null;
  let hubspotError: string | null = null;
  if (gate.hubspotPortalId && gate.hubspotFormGuid) {
    const fields = gate.fields
      .filter((f: LeadField) => f.hubspotName && f.hubspotName.length > 0)
      .map((f) => ({ name: f.hubspotName as string, value: cleaned[f.key] }));
    const origin =
      request.headers.get("origin") ||
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const result = await submitHubspotForm(
      gate.hubspotPortalId,
      gate.hubspotFormGuid,
      fields,
      {
        pageUri: `${origin}/v/${id}`,
        pageName: row.name,
        ipAddress: ipAddress ?? undefined,
      },
    );
    if (result.ok) {
      hubspotSubmittedAt = new Date();
    } else {
      hubspotError = result.error;
    }
  }

  await db.insert(flipbookLeads).values({
    flipbookId: id,
    cookieId,
    email,
    fields: cleaned,
    ipAddress,
    userAgent,
    hubspotSubmittedAt,
    hubspotError,
  });

  const res = Response.json({ ok: true });
  res.headers.set(
    "Set-Cookie",
    `${leadCookieName(id)}=${cookieId}; Max-Age=${LEAD_COOKIE_MAX_AGE_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  );
  return res;
}
