import { NextRequest } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  meetingNotes,
  meetingNoteTasks,
  noteAccess,
  noteMentions,
  noteTags,
  notificationPrefs,
  notifications,
} from "@/db/schema";
import { requireUser, canSeeNote } from "@/lib/workspace-auth";
import { extractMentionEmails, extractTaskAssignments } from "@/lib/mentions";
import { sendMentionEmail } from "@/lib/email";
import { loadUsers } from "@/lib/users";

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
  const tagRows = await db.select().from(noteTags).where(eq(noteTags.noteId, id));
  return Response.json({
    ...note,
    accessUsers: accessRows.map((r) => r.userEmail),
    tagIds: tagRows.map((r) => r.tagId),
  });
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
    setTagIds?: string[];
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

  if (Array.isArray(body.setTagIds)) {
    await db.delete(noteTags).where(eq(noteTags.noteId, id));
    const rows = body.setTagIds
      .filter((tagId): tagId is string => typeof tagId === "string" && tagId.length > 0)
      .map((tagId) => ({ noteId: id, tagId }));
    if (rows.length) await db.insert(noteTags).values(rows).onConflictDoNothing();
  }

  if (typeof body.body === "string") {
    await processMentions({
      noteId: id,
      html: body.body,
      actorEmail: user.email,
      origin: new URL(request.url).origin,
    });
  }

  return Response.json({ ok: true });
}

async function processMentions(opts: {
  noteId: string;
  html: string;
  actorEmail: string;
  origin: string;
}): Promise<void> {
  const { noteId, html, actorEmail, origin } = opts;

  const mentioned = extractMentionEmails(html);
  const assignments = extractTaskAssignments(html); // [{ taskId, email }]

  // 1) Update task ownerEmail for any task with a mention inside it that
  //    doesn't yet have an owner. Skip the actor (don't auto-assign yourself).
  const taskAssignments = assignments.filter((a) => a.email && a.email !== actorEmail);
  if (taskAssignments.length > 0) {
    const taskIds = [...new Set(taskAssignments.map((a) => a.taskId))];
    const existing = await db
      .select({ id: meetingNoteTasks.id, ownerEmail: meetingNoteTasks.ownerEmail })
      .from(meetingNoteTasks)
      .where(and(inArray(meetingNoteTasks.id, taskIds), isNull(meetingNoteTasks.ownerEmail)));
    const ownerlessIds = new Set(existing.map((r) => r.id));
    for (const a of taskAssignments) {
      if (!ownerlessIds.has(a.taskId)) continue;
      await db
        .update(meetingNoteTasks)
        .set({ ownerEmail: a.email })
        .where(and(eq(meetingNoteTasks.id, a.taskId), isNull(meetingNoteTasks.ownerEmail)));
    }
  }

  // 2) Diff mentions: anyone in the new set who isn't in note_mentions yet is "new".
  const prior = await db
    .select({ email: noteMentions.email })
    .from(noteMentions)
    .where(eq(noteMentions.noteId, noteId));
  const priorSet = new Set(prior.map((r) => r.email));
  const currentSet = new Set(mentioned);
  const newMentions = [...currentSet].filter((e) => !priorSet.has(e) && e !== actorEmail);
  const removed = [...priorSet].filter((e) => !currentSet.has(e));

  if (removed.length > 0) {
    await db
      .delete(noteMentions)
      .where(and(eq(noteMentions.noteId, noteId), inArray(noteMentions.email, removed)));
  }
  if (newMentions.length > 0) {
    await db
      .insert(noteMentions)
      .values(newMentions.map((email) => ({ noteId, email })))
      .onConflictDoNothing();
  }

  if (newMentions.length === 0) return;

  // Notify each newly-mentioned user (in-app + email).
  const [note] = await db
    .select({ title: meetingNotes.title })
    .from(meetingNotes)
    .where(eq(meetingNotes.id, noteId))
    .limit(1);
  const noteTitle = note?.title?.trim() || "a meeting note";

  const users = await loadUsers();
  const labelByEmail = new Map(users.map((u) => [u.email, u.label]));
  const actorLabel = labelByEmail.get(actorEmail) ?? actorEmail;

  // Load notification prefs for all recipients in one query
  const prefRows = await db
    .select()
    .from(notificationPrefs)
    .where(inArray(notificationPrefs.userEmail, newMentions));
  const prefsByEmail = new Map(prefRows.map((r) => [r.userEmail, r]));

  for (const email of newMentions) {
    const assignedTaskId = taskAssignments.find((a) => a.email === email)?.taskId ?? null;
    const isAssignment = !!assignedTaskId;
    const p = prefsByEmail.get(email);
    const inApp = isAssignment ? (p?.taskAssignInApp ?? true) : (p?.mentionsInApp ?? true);
    const wantEmail = isAssignment ? (p?.taskAssignEmail ?? true) : (p?.mentionsEmail ?? true);

    if (inApp) {
      await db.insert(notifications).values({
        recipientEmail: email,
        kind: isAssignment ? "task_assigned" : "mention",
        noteId,
        taskId: assignedTaskId,
        actorEmail,
        payload: { noteTitle, actorLabel },
      });
    }
    if (wantEmail) {
      sendMentionEmail({
        to: email,
        actorLabel,
        noteTitle,
        noteUrl: `${origin}/notes`,
        isAssignment,
      }).catch(() => {});
    }
  }
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
