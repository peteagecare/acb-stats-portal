import { NextRequest } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inboxTasks, sections, tasks } from "@/db/schema";
import { canSeeProject, requireUser } from "@/lib/workspace-auth";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [inbox] = await db.select().from(inboxTasks).where(eq(inboxTasks.id, id)).limit(1);
  if (!inbox || inbox.ownerEmail !== user.email) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: { projectId?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const projectId = body.projectId;
  if (!projectId) return Response.json({ error: "projectId required" }, { status: 400 });
  if (!(await canSeeProject(user.email, projectId))) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const [firstSection] = await db
    .select()
    .from(sections)
    .where(eq(sections.projectId, projectId))
    .orderBy(asc(sections.order))
    .limit(1);

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
      title: inbox.title,
      ownerEmail: inbox.ownerEmail,
      endDate: inbox.endDate,
      order: nextOrder,
      createdByEmail: user.email,
    })
    .returning();

  // Remove from inbox once promoted — the real task lives in the project now.
  await db.delete(inboxTasks).where(eq(inboxTasks.id, id));

  return Response.json({ ok: true, projectId, taskId: created.id });
}
