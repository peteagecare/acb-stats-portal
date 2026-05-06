import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectFavourites, projects } from "@/db/schema";
import { canSeeProject, requireUser, visibleProjectIds } from "@/lib/workspace-auth";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      projectId: projectFavourites.projectId,
      pinnedAt: projectFavourites.pinnedAt,
      name: projects.name,
      companyId: projects.companyId,
      status: projects.status,
    })
    .from(projectFavourites)
    .innerJoin(projects, eq(projects.id, projectFavourites.projectId))
    .where(eq(projectFavourites.userEmail, user.email))
    .orderBy(desc(projectFavourites.pinnedAt));

  // Filter out anything the user no longer has access to (visibility could
  // have changed since they pinned it). Stale rows stay in the DB until they
  // explicitly unpin.
  const visible = await visibleProjectIds(user.email);
  const filtered = rows.filter((r) => visible.has(r.projectId));

  return Response.json({
    projectIds: filtered.map((r) => r.projectId),
    favourites: filtered.map((r) => ({
      projectId: r.projectId,
      name: r.name,
      companyId: r.companyId,
      status: r.status,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { projectId?: string; pinned?: boolean };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const projectId = body.projectId;
  if (!projectId) return Response.json({ error: "projectId required" }, { status: 400 });
  if (!(await canSeeProject(user.email, projectId))) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  if (body.pinned) {
    await db
      .insert(projectFavourites)
      .values({ projectId, userEmail: user.email })
      .onConflictDoNothing();
  } else {
    await db
      .delete(projectFavourites)
      .where(and(eq(projectFavourites.projectId, projectId), eq(projectFavourites.userEmail, user.email)));
  }

  return Response.json({ ok: true });
}
