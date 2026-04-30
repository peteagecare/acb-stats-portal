import { NextRequest } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { projectLinks } from "@/db/schema";
import { requireUser, canSeeProject } from "@/lib/workspace-auth";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return Response.json({ error: "projectId required" }, { status: 400 });
  if (!(await canSeeProject(user.email, projectId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(projectLinks)
    .where(eq(projectLinks.projectId, projectId))
    .orderBy(asc(projectLinks.createdAt));
  return Response.json({ links: rows });
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { projectId?: string; label?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = body.projectId;
  const label = (body.label ?? "").trim();
  const url = (body.url ?? "").trim();
  if (!projectId || !label || !url) {
    return Response.json({ error: "projectId, label, url required" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) {
    return Response.json({ error: "URL must start with http:// or https://" }, { status: 400 });
  }
  if (!(await canSeeProject(user.email, projectId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [created] = await db
    .insert(projectLinks)
    .values({ projectId, label, url, createdByEmail: user.email })
    .returning();
  return Response.json(created);
}
