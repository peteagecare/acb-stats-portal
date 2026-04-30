import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { comments } from "@/db/schema";
import { requireUser, canSeeParent } from "@/lib/workspace-auth";

interface Params { params: Promise<{ id: string }>; }

async function loadComment(id: string) {
  const [row] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  return row;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const c = await loadComment(id);
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  if (c.authorEmail !== user.email) {
    return Response.json({ error: "Only the author can edit" }, { status: 403 });
  }
  if (!(await canSeeParent(user.email, c.parentType, c.parentId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: { body?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = (body.body ?? "").trim();
  if (!text) return Response.json({ error: "Comment cannot be empty" }, { status: 400 });

  await db.update(comments).set({ body: text, editedAt: new Date() }).where(eq(comments.id, id));
  const [updated] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  return Response.json(updated);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const c = await loadComment(id);
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  if (c.authorEmail !== user.email) {
    return Response.json({ error: "Only the author can delete" }, { status: 403 });
  }
  await db.delete(comments).where(eq(comments.id, id));
  return Response.json({ ok: true });
}
