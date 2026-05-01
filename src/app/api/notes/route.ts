import { NextRequest } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { meetingNotes, noteAccess, noteTags } from "@/db/schema";
import { requireUser, visibleNoteIds } from "@/lib/workspace-auth";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ids = await visibleNoteIds(user.email);
  if (ids.size === 0) return Response.json({ notes: [] });

  const rows = await db
    .select()
    .from(meetingNotes)
    .where(inArray(meetingNotes.id, [...ids]))
    .orderBy(desc(meetingNotes.updatedAt));

  // Fetch access lists for restricted notes (so the UI can pre-fill the picker)
  const restrictedIds = rows.filter((r) => r.accessMode === "restricted").map((r) => r.id);
  const accessRows = restrictedIds.length
    ? await db.select().from(noteAccess).where(inArray(noteAccess.noteId, restrictedIds))
    : [];
  const usersByNote = new Map<string, string[]>();
  for (const r of accessRows) {
    const list = usersByNote.get(r.noteId) ?? [];
    list.push(r.userEmail);
    usersByNote.set(r.noteId, list);
  }

  const allIds = rows.map((r) => r.id);
  const tagRows = allIds.length
    ? await db.select().from(noteTags).where(inArray(noteTags.noteId, allIds))
    : [];
  const tagsByNote = new Map<string, string[]>();
  for (const r of tagRows) {
    const list = tagsByNote.get(r.noteId) ?? [];
    list.push(r.tagId);
    tagsByNote.set(r.noteId, list);
  }

  return Response.json({
    notes: rows.map((r) => ({
      ...r,
      accessUsers: usersByNote.get(r.id) ?? [],
      tagIds: tagsByNote.get(r.id) ?? [],
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  type Body = { title?: string; body?: string; meetingDate?: string | null };
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const [created] = await db
    .insert(meetingNotes)
    .values({
      title: body.title?.trim() || "",
      body: body.body ?? "",
      meetingDate: body.meetingDate || null,
      authorEmail: user.email,
      // accessMode defaults to "everyone" so the team sees it immediately
    })
    .returning();

  return Response.json(created);
}
