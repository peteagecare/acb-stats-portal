import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { tasks, projects, companies, taskCollaborators } from "@/db/schema";
import { requireUser, visibleProjectIds } from "@/lib/workspace-auth";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const visible = await visibleProjectIds(user.email);
  if (visible.size === 0) {
    return Response.json({ tasks: [], people: [], me: user.email });
  }

  const projIds = [...visible];

  // One round-trip: tasks + project + company context
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      ownerEmail: tasks.ownerEmail,
      createdByEmail: tasks.createdByEmail,
      startDate: tasks.startDate,
      endDate: tasks.endDate,
      status: tasks.status,
      priority: tasks.priority,
      completed: tasks.completed,
      completedAt: tasks.completedAt,
      parentTaskId: tasks.parentTaskId,
      projectId: tasks.projectId,
      projectName: projects.name,
      projectStatus: projects.status,
      companyId: projects.companyId,
      companyName: companies.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(companies, eq(projects.companyId, companies.id))
    .where(inArray(tasks.projectId, projIds));

  // Collaborators for any task in scope (only used to surface "I'm a collaborator")
  const taskIds = rows.map((r) => r.id);
  const collabRows = taskIds.length
    ? await db
        .select()
        .from(taskCollaborators)
        .where(inArray(taskCollaborators.taskId, taskIds))
    : [];
  const collabsByTask = new Map<string, string[]>();
  for (const c of collabRows) {
    const list = collabsByTask.get(c.taskId) ?? [];
    list.push(c.userEmail);
    collabsByTask.set(c.taskId, list);
  }

  const enriched = rows.map((r) => ({
    ...r,
    collaborators: collabsByTask.get(r.id) ?? [],
  }));

  return Response.json({
    me: user.email,
    tasks: enriched,
  });
}
