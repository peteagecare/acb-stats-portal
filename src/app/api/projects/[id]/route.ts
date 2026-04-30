import { NextRequest } from "next/server";
import { eq, inArray, asc } from "drizzle-orm";
import { db } from "@/db/client";
import {
  projects,
  projectAccess,
  projectCollaborators,
  sections,
  tasks,
  taskCollaborators,
} from "@/db/schema";
import { requireUser, canSeeProject } from "@/lib/workspace-auth";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canSeeProject(user.email, id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const [collabRows, accessRows, sectionRows, taskRows] = await Promise.all([
    db.select().from(projectCollaborators).where(eq(projectCollaborators.projectId, id)),
    db.select().from(projectAccess).where(eq(projectAccess.projectId, id)),
    db.select().from(sections).where(eq(sections.projectId, id)).orderBy(asc(sections.order)),
    db.select().from(tasks).where(eq(tasks.projectId, id)).orderBy(asc(tasks.order)),
  ]);

  const taskIds = taskRows.map((t) => t.id);
  const taskCollabs = taskIds.length
    ? await db.select().from(taskCollaborators).where(inArray(taskCollaborators.taskId, taskIds))
    : [];
  const collabsByTask = new Map<string, string[]>();
  for (const c of taskCollabs) {
    const list = collabsByTask.get(c.taskId) ?? [];
    list.push(c.userEmail);
    collabsByTask.set(c.taskId, list);
  }

  return Response.json({
    project: {
      ...project,
      collaborators: collabRows.map((c) => c.userEmail),
      accessUsers: accessRows.map((a) => a.userEmail),
    },
    sections: sectionRows,
    tasks: taskRows.map((t) => ({
      ...t,
      collaborators: collabsByTask.get(t.id) ?? [],
    })),
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canSeeProject(user.email, id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  type Body = {
    name?: string;
    description?: string | null;
    notes?: string | null;
    ownerEmail?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    status?: "planning" | "active" | "on_hold" | "done" | "archived";
    type?: "quarterly" | "initiative" | "ongoing";
    department?: "ppc" | "seo" | "content" | "web" | null;
    accessMode?: "everyone" | "restricted";
    setCollaborators?: string[];
    setAccessUsers?: string[];
  };
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Partial<typeof projects.$inferInsert> = {};
  if (typeof body.name === "string") {
    const v = body.name.trim();
    if (!v) return Response.json({ error: "Name required" }, { status: 400 });
    updates.name = v;
  }
  if (body.description !== undefined) updates.description = body.description?.toString().trim() || null;
  if (body.notes !== undefined) updates.notes = body.notes?.toString() || null;
  if (body.ownerEmail !== undefined) updates.ownerEmail = body.ownerEmail || null;
  if (body.startDate !== undefined) updates.startDate = body.startDate || null;
  if (body.endDate !== undefined) updates.endDate = body.endDate || null;
  if (body.status) updates.status = body.status;
  if (body.type === "quarterly" || body.type === "initiative" || body.type === "ongoing") {
    updates.type = body.type;
  }
  if (body.department === null) {
    updates.department = null;
  } else if (
    body.department === "ppc" ||
    body.department === "seo" ||
    body.department === "content" ||
    body.department === "web"
  ) {
    updates.department = body.department;
  }
  if (body.accessMode === "everyone" || body.accessMode === "restricted") {
    updates.accessMode = body.accessMode;
  }

  if (Object.keys(updates).length) {
    await db.update(projects).set(updates).where(eq(projects.id, id));
  }

  if (Array.isArray(body.setCollaborators)) {
    await db.delete(projectCollaborators).where(eq(projectCollaborators.projectId, id));
    const rows = body.setCollaborators
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .map((userEmail) => ({ projectId: id, userEmail }));
    if (rows.length)
      await db.insert(projectCollaborators).values(rows).onConflictDoNothing();
  }

  if (Array.isArray(body.setAccessUsers)) {
    await db.delete(projectAccess).where(eq(projectAccess.projectId, id));
    const rows = body.setAccessUsers
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .map((userEmail) => ({ projectId: id, userEmail }));
    if (rows.length) await db.insert(projectAccess).values(rows).onConflictDoNothing();
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canSeeProject(user.email, id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(projects).where(eq(projects.id, id));
  return Response.json({ ok: true });
}
