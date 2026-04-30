import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sections } from "@/db/schema";
import { requireUser, canSeeProject } from "@/lib/workspace-auth";

interface Params {
  params: Promise<{ id: string }>;
}

async function loadSection(id: string) {
  const [row] = await db.select().from(sections).where(eq(sections.id, id)).limit(1);
  return row;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const section = await loadSection(id);
  if (!section) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await canSeeProject(user.email, section.projectId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: { name?: string; order?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Partial<typeof sections.$inferInsert> = {};
  if (typeof body.name === "string") {
    const v = body.name.trim();
    if (!v) return Response.json({ error: "Name required" }, { status: 400 });
    updates.name = v;
  }
  if (typeof body.order === "number") updates.order = body.order;
  if (Object.keys(updates).length) {
    await db.update(sections).set(updates).where(eq(sections.id, id));
  }
  const [updated] = await db.select().from(sections).where(eq(sections.id, id)).limit(1);
  return Response.json(updated);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const section = await loadSection(id);
  if (!section) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await canSeeProject(user.email, section.projectId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  await db.delete(sections).where(eq(sections.id, id));
  return Response.json({ ok: true });
}
