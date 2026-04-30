import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { meetingNotes } from "@/db/schema";
import { requireUser } from "@/lib/workspace-auth";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [note] = await db
    .select()
    .from(meetingNotes)
    .where(and(eq(meetingNotes.id, id), eq(meetingNotes.authorEmail, user.email)))
    .limit(1);

  if (!note) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(note);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [existing] = await db
    .select()
    .from(meetingNotes)
    .where(and(eq(meetingNotes.id, id), eq(meetingNotes.authorEmail, user.email)))
    .limit(1);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  type Body = { title?: string; body?: string; meetingDate?: string | null };
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Partial<typeof meetingNotes.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title === "string") updates.title = body.title;
  if (typeof body.body === "string") updates.body = body.body;
  if (body.meetingDate !== undefined) updates.meetingDate = body.meetingDate || null;

  await db.update(meetingNotes).set(updates).where(eq(meetingNotes.id, id));
  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db
    .delete(meetingNotes)
    .where(and(eq(meetingNotes.id, id), eq(meetingNotes.authorEmail, user.email)));

  return Response.json({ ok: true });
}
