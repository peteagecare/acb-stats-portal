import { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { tasks, taskCollaborators } from "@/db/schema";
import { requireUser, canSeeProject } from "@/lib/workspace-auth";

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  type Body = {
    projectId?: string;
    sectionId?: string | null;
    parentTaskId?: string | null;
    title?: string;
    description?: string;
    ownerEmail?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    priority?: "low" | "medium" | "high" | null;
    estimatedHours?: number | null;
    goal?: string;
    expectedOutcome?: string;
    collaborators?: string[];
  };
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = body.projectId;
  const title = (body.title ?? "").trim();
  if (!projectId || !title) {
    return Response.json({ error: "projectId and title required" }, { status: 400 });
  }
  if (!(await canSeeProject(user.email, projectId))) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

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
      sectionId: body.sectionId || null,
      parentTaskId: body.parentTaskId || null,
      title,
      description: body.description?.trim() || null,
      ownerEmail: body.ownerEmail || null,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      priority: body.priority ?? null,
      estimatedHours:
        typeof body.estimatedHours === "number" && Number.isFinite(body.estimatedHours)
          ? body.estimatedHours
          : null,
      goal: body.goal?.trim() || null,
      expectedOutcome: body.expectedOutcome?.trim() || null,
      order: nextOrder,
      createdByEmail: user.email,
    })
    .returning();

  if (body.collaborators?.length) {
    const rows = body.collaborators
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .map((userEmail) => ({ taskId: created.id, userEmail }));
    if (rows.length)
      await db.insert(taskCollaborators).values(rows).onConflictDoNothing();
  }

  return Response.json(created);
}
