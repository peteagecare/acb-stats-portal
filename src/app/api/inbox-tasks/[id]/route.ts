import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inboxTasks } from "@/db/schema";
import { requireUser } from "@/lib/workspace-auth";

interface Params {
  params: Promise<{ id: string }>;
}

async function loadOwned(id: string, email: string) {
  const [row] = await db.select().from(inboxTasks).where(eq(inboxTasks.id, id)).limit(1);
  if (!row || row.ownerEmail !== email) return null;
  return row;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = await loadOwned(id, user.email);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  let body: { title?: string; completed?: boolean; endDate?: string | null; order?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Partial<typeof inboxTasks.$inferInsert> = {};
  if (typeof body.title === "string") {
    const v = body.title.trim();
    if (!v) return Response.json({ error: "Title required" }, { status: 400 });
    updates.title = v;
  }
  if (typeof body.completed === "boolean") updates.completed = body.completed;
  if (body.endDate !== undefined) updates.endDate = body.endDate || null;
  if (typeof body.order === "number") updates.order = body.order;

  if (Object.keys(updates).length) {
    await db.update(inboxTasks).set(updates).where(eq(inboxTasks.id, id));
  }
  const [updated] = await db.select().from(inboxTasks).where(eq(inboxTasks.id, id)).limit(1);
  return Response.json(updated);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = await loadOwned(id, user.email);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  await db.delete(inboxTasks).where(eq(inboxTasks.id, id));
  return Response.json({ ok: true });
}
