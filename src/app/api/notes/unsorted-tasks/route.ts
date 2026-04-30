import { NextRequest } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { meetingNotes, meetingNoteTasks } from "@/db/schema";
import { requireUser } from "@/lib/workspace-auth";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: meetingNoteTasks.id,
      title: meetingNoteTasks.title,
      completed: meetingNoteTasks.completed,
      ownerEmail: meetingNoteTasks.ownerEmail,
      endDate: meetingNoteTasks.endDate,
      createdAt: meetingNoteTasks.createdAt,
      noteId: meetingNotes.id,
      noteTitle: meetingNotes.title,
      noteMeetingDate: meetingNotes.meetingDate,
    })
    .from(meetingNoteTasks)
    .innerJoin(meetingNotes, eq(meetingNoteTasks.noteId, meetingNotes.id))
    .where(and(
      eq(meetingNotes.authorEmail, user.email),
      isNull(meetingNoteTasks.projectId),
      eq(meetingNoteTasks.completed, false),
    ))
    .orderBy(asc(meetingNoteTasks.createdAt));

  return Response.json({ tasks: rows });
}
