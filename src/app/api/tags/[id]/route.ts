import { NextRequest } from "next/server";
import { eq, sql as rawSql, and, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { tags } from "@/db/schema";
import { requireUser } from "@/lib/workspace-auth";

interface Params { params: Promise<{ id: string }>; }

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  let body: { name?: string; color?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Partial<typeof tags.$inferInsert> = {};
  if (typeof body.name === "string") {
    const v = body.name.trim();
    if (!v) return Response.json({ error: "Name required" }, { status: 400 });
    if (v.length > 60) return Response.json({ error: "Name too long" }, { status: 400 });
    // Ensure no other tag already has this name (case-insensitive)
    const collision = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(rawSql`lower(${tags.name}) = lower(${v})`, ne(tags.id, id)))
      .limit(1);
    if (collision[0]) return Response.json({ error: "A tag with that name already exists" }, { status: 409 });
    updates.name = v;
  }
  if (typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color)) {
    updates.color = body.color;
  }

  if (Object.keys(updates).length) {
    await db.update(tags).set(updates).where(eq(tags.id, id));
  }
  const [row] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(row);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.delete(tags).where(eq(tags.id, id));
  return Response.json({ ok: true });
}
