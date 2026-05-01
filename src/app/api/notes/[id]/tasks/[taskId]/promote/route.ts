import { NextRequest } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { meetingNoteTasks, sections, tasks } from "@/db/schema";
import { canSeeNote, canSeeProject, requireUser } from "@/lib/workspace-auth";

interface Params {
  params: Promise<{ id: string; taskId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, taskId } = await params;

  if (!(await canSeeNote(user.email, id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [noteTask] = await db
    .select()
    .from(meetingNoteTasks)
    .where(and(eq(meetingNoteTasks.id, taskId), eq(meetingNoteTasks.noteId, id)))
    .limit(1);
  if (!noteTask) return Response.json({ error: "Task not found" }, { status: 404 });

  let body: { projectId?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const projectId = body.projectId;
  if (!projectId) return Response.json({ error: "projectId required" }, { status: 400 });
  if (!(await canSeeProject(user.email, projectId))) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // First section in the project (typically "To do")
  const [firstSection] = await db
    .select()
    .from(sections)
    .where(eq(sections.projectId, projectId))
    .orderBy(asc(sections.order))
    .limit(1);

  // Next order in the project's task list
  const [last] = await db
    .select({ order: tasks.order })
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(desc(tasks.order))
    .limit(1);
  const nextOrder = (last?.order ?? -1) + 1;

  const [created] = await db
    .insert(tasks)
    .values({
      projectId,
      sectionId: firstSection?.id ?? null,
      title: noteTask.title,
      ownerEmail: noteTask.ownerEmail,
      endDate: noteTask.endDate,
      order: nextOrder,
      createdByEmail: user.email,
    })
    .returning();

  await db
    .update(meetingNoteTasks)
    .set({ projectId, promotedTaskId: created.id })
    .where(eq(meetingNoteTasks.id, taskId));

  return Response.json({ ok: true, projectId, taskId: created.id });
}
