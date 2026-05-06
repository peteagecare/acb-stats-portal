import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/db/client";
import { flipbooks } from "@/db/schema";
import {
  DEFAULT_SETTINGS,
  type LeadGate,
  type Overlay,
  type ProjectSettings,
} from "@/lib/flipbook/types";
import {
  sanitiseLeadGate,
  sanitiseOverlays,
  sanitiseSettings,
} from "@/lib/flipbook/sanitise";
import { requireUser } from "@/lib/workspace-auth";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/flipbooks/[id]">,
): Promise<Response> {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(flipbooks)
    .where(eq(flipbooks.id, id))
    .limit(1);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        settings?: unknown;
        overlays?: unknown;
        leadGate?: unknown;
      }
    | null;
  if (!body) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const update: {
    name?: string;
    settings?: ProjectSettings;
    overlays?: Overlay[];
    leadGate?: LeadGate;
  } = {};

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (trimmed.length > 0 && trimmed.length <= 200) {
      update.name = trimmed;
    }
  }

  if (body.settings !== undefined) {
    const patch = sanitiseSettings(body.settings);
    if (patch === null) {
      return Response.json({ error: "Invalid settings" }, { status: 400 });
    }
    update.settings = {
      ...DEFAULT_SETTINGS,
      ...(existing.settings as ProjectSettings),
      ...patch,
    };
  }

  if (body.overlays !== undefined) {
    const sanitised = sanitiseOverlays(body.overlays);
    if (sanitised === null) {
      return Response.json({ error: "Invalid overlays" }, { status: 400 });
    }
    update.overlays = sanitised;
  }

  if (body.leadGate !== undefined) {
    const sanitised = sanitiseLeadGate(body.leadGate);
    if (sanitised === null) {
      return Response.json({ error: "Invalid leadGate" }, { status: 400 });
    }
    update.leadGate = sanitised;
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ ok: true });
  }

  await db.update(flipbooks).set(update).where(eq(flipbooks.id, id));
  return Response.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/flipbooks/[id]">,
): Promise<Response> {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(flipbooks)
    .where(eq(flipbooks.id, id))
    .limit(1);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Best-effort blob cleanup; ignore individual failures so DB row still gets dropped.
  const urls: string[] = [
    existing.sourcePdfUrl,
    ...((existing.pageUrls as string[]) ?? []),
  ];
  for (const ovl of (existing.overlays as Overlay[]) ?? []) {
    if (ovl.type === "gif") urls.push(ovl.url);
  }
  await Promise.allSettled(urls.map((u) => del(u).catch(() => undefined)));

  await db.delete(flipbooks).where(eq(flipbooks.id, id));
  return Response.json({ ok: true });
}
