import { NextRequest } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, projectCollaborators, sections, tasks } from "@/db/schema";
import { requireUser, visibleProjectIds, canSeeCompany } from "@/lib/workspace-auth";

const DEFAULT_SECTIONS = ["To do", "In progress", "Done"];

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");

  const visible = await visibleProjectIds(user.email);
  if (visible.size === 0) return Response.json({ projects: [] });

  const ids = [...visible];
  let rows = await db.select().from(projects).where(inArray(projects.id, ids));

  if (companyId) rows = rows.filter((p) => p.companyId === companyId);

  if (rows.length === 0) return Response.json({ projects: [] });

  const projIds = rows.map((p) => p.id);
  const collabRows = await db
    .select()
    .from(projectCollaborators)
    .where(inArray(projectCollaborators.projectId, projIds));
  const collabsByProject = new Map<string, string[]>();
  for (const c of collabRows) {
    const list = collabsByProject.get(c.projectId) ?? [];
    list.push(c.userEmail);
    collabsByProject.set(c.projectId, list);
  }

  const taskRows = await db
    .select({ projectId: tasks.projectId, completed: tasks.completed })
    .from(tasks)
    .where(inArray(tasks.projectId, projIds));
  const counts = new Map<string, { open: number; done: number }>();
  for (const t of taskRows) {
    const c = counts.get(t.projectId) ?? { open: 0, done: 0 };
    if (t.completed) c.done++;
    else c.open++;
    counts.set(t.projectId, c);
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return Response.json({
    projects: rows.map((p) => ({
      ...p,
      collaborators: collabsByProject.get(p.id) ?? [],
      taskCounts: counts.get(p.id) ?? { open: 0, done: 0 },
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  type Body = {
    companyId?: string;
    name?: string;
    description?: string;
    ownerEmail?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    collaborators?: string[];
  };
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) return Response.json({ error: "Name required" }, { status: 400 });
  if (!body.companyId) return Response.json({ error: "companyId required" }, { status: 400 });

  if (!(await canSeeCompany(user.email, body.companyId))) {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }

  const [created] = await db
    .insert(projects)
    .values({
      companyId: body.companyId,
      name,
      description: body.description?.trim() || null,
      ownerEmail: body.ownerEmail || null,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      createdByEmail: user.email,
    })
    .returning();

  // Seed default sections
  await db
    .insert(sections)
    .values(DEFAULT_SECTIONS.map((name, i) => ({ projectId: created.id, name, order: i })));

  if (body.collaborators?.length) {
    const rows = body.collaborators
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .map((userEmail) => ({ projectId: created.id, userEmail }));
    if (rows.length)
      await db.insert(projectCollaborators).values(rows).onConflictDoNothing();
  }

  return Response.json(created);
}
