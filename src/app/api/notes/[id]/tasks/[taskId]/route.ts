import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { meetingNotes, meetingNoteTasks } from "@/db/schema";
import { requireUser } from "@/lib/workspace-auth";

interface Params {
  params: Promise<{ id: string; taskId: string }>;
}

async function ownNote(noteId: string, email: string) {
  const [n] = await db
    .select()
    .from(meetingNotes)
    .where(and(eq(meetingNotes.id, noteId), eq(meetingNotes.authorEmail, email)))
    .limit(1);
  return n ?? null;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id, taskId } = await params;
  if (!(await ownNote(id, user.email))) return Response.json({ error: "Not found" }, { status: 404 });

  type Body = {
    title?: string;
    completed?: boolean;
    ownerEmail?: string | null;
    endDate?: string | null;
    projectId?: string | null;
    promotedTaskId?: string | null;
  };
  let body: Body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const updates: Partial<typeof meetingNoteTasks.$inferInsert> = {};
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.completed === "boolean") updates.completed = body.completed;
  if (body.ownerEmail !== undefined) updates.ownerEmail = body.ownerEmail || null;
  if (body.endDate !== undefined) updates.endDate = body.endDate || null;
  if (body.projectId !== undefined) updates.projectId = body.projectId;
  if (body.promotedTaskId !== undefined) updates.promotedTaskId = body.promotedTaskId;

  if (Object.keys(updates).length) {
    await db
      .update(meetingNoteTasks)
      .set(updates)
      .where(and(eq(meetingNoteTasks.id, taskId), eq(meetingNoteTasks.noteId, id)));
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id, taskId } = await params;
  if (!(await ownNote(id, user.email))) return Response.json({ error: "Not found" }, { status: 404 });

  await db
    .delete(meetingNoteTasks)
    .where(and(eq(meetingNoteTasks.id, taskId), eq(meetingNoteTasks.noteId, id)));
  return Response.json({ ok: true });
}
