import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { tasks, projects, taskTags } from "@/db/schema";
import { canSeeCompany, requireUser, visibleProjectIds } from "@/lib/workspace-auth";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canSeeCompany(user.email, id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const visible = await visibleProjectIds(user.email);
  if (visible.size === 0) return Response.json({ tasks: [] });

  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      ownerEmail: tasks.ownerEmail,
      startDate: tasks.startDate,
      endDate: tasks.endDate,
      priority: tasks.priority,
      completed: tasks.completed,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      parentTaskId: tasks.parentTaskId,
      projectId: tasks.projectId,
      projectName: projects.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(
      eq(projects.companyId, id),
      inArray(tasks.projectId, [...visible]),
    ));

  const taskIds = rows.map((r) => r.id);
  const tagRows = taskIds.length
    ? await db.select().from(taskTags).where(inArray(taskTags.taskId, taskIds))
    : [];
  const tagsByTask = new Map<string, string[]>();
  for (const t of tagRows) {
    const list = tagsByTask.get(t.taskId) ?? [];
    list.push(t.tagId);
    tagsByTask.set(t.taskId, list);
  }

  return Response.json({
    tasks: rows.map((r) => ({ ...r, tagIds: tagsByTask.get(r.id) ?? [] })),
  });
}
