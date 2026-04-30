import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectLinks } from "@/db/schema";
import { requireUser, canSeeProject } from "@/lib/workspace-auth";

interface Params { params: Promise<{ id: string }>; }

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [link] = await db.select().from(projectLinks).where(eq(projectLinks.id, id)).limit(1);
  if (!link) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await canSeeProject(user.email, link.projectId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: { label?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Partial<typeof projectLinks.$inferInsert> = {};
  if (typeof body.label === "string") {
    const v = body.label.trim();
    if (!v) return Response.json({ error: "Label required" }, { status: 400 });
    updates.label = v;
  }
  if (typeof body.url === "string") {
    const v = body.url.trim();
    if (!/^https?:\/\//i.test(v)) {
      return Response.json({ error: "URL must start with http:// or https://" }, { status: 400 });
    }
    updates.url = v;
  }

  if (Object.keys(updates).length) {
    await db.update(projectLinks).set(updates).where(eq(projectLinks.id, id));
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [link] = await db.select().from(projectLinks).where(eq(projectLinks.id, id)).limit(1);
  if (!link) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await canSeeProject(user.email, link.projectId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  await db.delete(projectLinks).where(eq(projectLinks.id, id));
  return Response.json({ ok: true });
}
