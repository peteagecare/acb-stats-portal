import { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { sections } from "@/db/schema";
import { requireUser, canSeeProject } from "@/lib/workspace-auth";

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { projectId?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = body.projectId;
  const name = (body.name ?? "").trim();
  if (!projectId || !name) {
    return Response.json({ error: "projectId and name required" }, { status: 400 });
  }
  if (!(await canSeeProject(user.email, projectId))) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const [last] = await db
    .select({ order: sections.order })
    .from(sections)
    .where(eq(sections.projectId, projectId))
    .orderBy(desc(sections.order))
    .limit(1);
  const nextOrder = (last?.order ?? -1) + 1;

  const [created] = await db
    .insert(sections)
    .values({ projectId, name, order: nextOrder })
    .returning();
  return Response.json(created);
}
