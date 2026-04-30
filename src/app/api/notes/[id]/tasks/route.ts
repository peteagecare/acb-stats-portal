import { NextRequest } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { meetingNotes, meetingNoteTasks } from "@/db/schema";
import { requireUser } from "@/lib/workspace-auth";

interface Params {
  params: Promise<{ id: string }>;
}

async function ownNote(noteId: string, email: string) {
  const [n] = await db
    .select()
    .from(meetingNotes)
    .where(and(eq(meetingNotes.id, noteId), eq(meetingNotes.authorEmail, email)))
    .limit(1);
  return n ?? null;
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await ownNote(id, user.email))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const rows = await db
    .select()
    .from(meetingNoteTasks)
    .where(eq(meetingNoteTasks.noteId, id))
    .orderBy(asc(meetingNoteTasks.order));
  return Response.json({ tasks: rows });
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await ownNote(id, user.email))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: { title?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const title = (body.title ?? "").trim();
  if (!title) return Response.json({ error: "Title required" }, { status: 400 });

  const [last] = await db
    .select({ order: meetingNoteTasks.order })
    .from(meetingNoteTasks)
    .where(eq(meetingNoteTasks.noteId, id))
    .orderBy(desc(meetingNoteTasks.order))
    .limit(1);
  const nextOrder = (last?.order ?? -1) + 1;

  const [created] = await db
    .insert(meetingNoteTasks)
    .values({ noteId: id, title, order: nextOrder })
    .returning();
  return Response.json(created);
}
