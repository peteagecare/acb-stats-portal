import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { meetingNotes, noteAccess } from "@/db/schema";
import { requireUser, canSeeNote } from "@/lib/workspace-auth";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  if (!(await canSeeNote(user.email, id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [note] = await db.select().from(meetingNotes).where(eq(meetingNotes.id, id)).limit(1);
  if (!note) return Response.json({ error: "Not found" }, { status: 404 });

  const accessRows =
    note.accessMode === "restricted"
      ? await db.select().from(noteAccess).where(eq(noteAccess.noteId, id))
      : [];
  return Response.json({ ...note, accessUsers: accessRows.map((r) => r.userEmail) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Anyone who can see the note can edit it (matches the project model where
  // collaborators can update). The author can always edit.
  if (!(await canSeeNote(user.email, id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  type Body = {
    title?: string;
    body?: string;
    meetingDate?: string | null;
    accessMode?: "everyone" | "restricted";
    setAccessUsers?: string[];
  };
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
  if (body.accessMode === "everyone" || body.accessMode === "restricted") {
    updates.accessMode = body.accessMode;
  }

  await db.update(meetingNotes).set(updates).where(eq(meetingNotes.id, id));

  if (Array.isArray(body.setAccessUsers)) {
    await db.delete(noteAccess).where(eq(noteAccess.noteId, id));
    const rows = body.setAccessUsers
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .map((userEmail) => ({ noteId: id, userEmail }));
    if (rows.length) await db.insert(noteAccess).values(rows).onConflictDoNothing();
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Only the author can delete a note (safer than letting any viewer wipe it)
  const [note] = await db.select().from(meetingNotes).where(eq(meetingNotes.id, id)).limit(1);
  if (!note) return Response.json({ error: "Not found" }, { status: 404 });
  if (note.authorEmail !== user.email) {
    return Response.json({ error: "Only the author can delete this note" }, { status: 403 });
  }

  await db.delete(meetingNotes).where(eq(meetingNotes.id, id));
  return Response.json({ ok: true });
}
