import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { tasks, taskCollaborators } from "@/db/schema";
import { requireUser, canSeeProject } from "@/lib/workspace-auth";

interface Params {
  params: Promise<{ id: string }>;
}

async function loadTask(id: string) {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return row;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const task = await loadTask(id);
  if (!task) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await canSeeProject(user.email, task.projectId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  type Body = {
    title?: string;
    description?: string | null;
    sectionId?: string | null;
    ownerEmail?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    priority?: "low" | "medium" | "high" | null;
    estimatedHours?: number | null;
    goal?: string | null;
    expectedOutcome?: string | null;
    status?: "todo" | "doing" | "blocked" | "done";
    completed?: boolean;
    order?: number;
    setCollaborators?: string[];
  };
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Partial<typeof tasks.$inferInsert> = {};
  if (typeof body.title === "string") {
    const v = body.title.trim();
    if (!v) return Response.json({ error: "Title required" }, { status: 400 });
    updates.title = v;
  }
  if (body.description !== undefined)
    updates.description = body.description?.toString().trim() || null;
  if (body.sectionId !== undefined) updates.sectionId = body.sectionId || null;
  if (body.ownerEmail !== undefined) updates.ownerEmail = body.ownerEmail || null;
  if (body.startDate !== undefined) updates.startDate = body.startDate || null;
  if (body.endDate !== undefined) updates.endDate = body.endDate || null;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.estimatedHours !== undefined) {
    updates.estimatedHours =
      typeof body.estimatedHours === "number" && Number.isFinite(body.estimatedHours)
        ? body.estimatedHours
        : null;
  }
  if (body.goal !== undefined) updates.goal = body.goal?.toString().trim() || null;
  if (body.expectedOutcome !== undefined)
    updates.expectedOutcome = body.expectedOutcome?.toString().trim() || null;
  if (body.status) updates.status = body.status;
  if (typeof body.order === "number") updates.order = body.order;

  if (typeof body.completed === "boolean" && body.completed !== task.completed) {
    updates.completed = body.completed;
    updates.completedAt = body.completed ? new Date() : null;
    if (body.completed && !body.status) updates.status = "done";
  }

  if (Object.keys(updates).length) {
    await db.update(tasks).set(updates).where(eq(tasks.id, id));
  }

  if (Array.isArray(body.setCollaborators)) {
    await db.delete(taskCollaborators).where(eq(taskCollaborators.taskId, id));
    const rows = body.setCollaborators
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .map((userEmail) => ({ taskId: id, userEmail }));
    if (rows.length) await db.insert(taskCollaborators).values(rows).onConflictDoNothing();
  }

  const [updated] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return Response.json(updated);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const task = await loadTask(id);
  if (!task) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await canSeeProject(user.email, task.projectId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  await db.delete(tasks).where(eq(tasks.id, id));
  return Response.json({ ok: true });
}
