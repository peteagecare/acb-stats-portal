import { NextRequest } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { companies, companyAccess, projects } from "@/db/schema";
import { requireUser, canSeeCompany } from "@/lib/workspace-auth";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canSeeCompany(user.email, id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!company) return Response.json({ error: "Not found" }, { status: 404 });

  const access = await db
    .select({ userEmail: companyAccess.userEmail })
    .from(companyAccess)
    .where(eq(companyAccess.companyId, id));

  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.companyId, id));

  return Response.json({
    ...company,
    accessUsers: access.map((a) => a.userEmail),
    projectCount: projectRows.length,
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canSeeCompany(user.email, id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  type Patch = {
    name?: string;
    description?: string | null;
    accessMode?: "everyone" | "restricted";
    addUsers?: string[];
    removeUsers?: string[];
    setUsers?: string[];
  };
  let body: Patch;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Partial<typeof companies.$inferInsert> = {};
  if (typeof body.name === "string") {
    const v = body.name.trim();
    if (!v) return Response.json({ error: "Name required" }, { status: 400 });
    updates.name = v;
  }
  if (body.description !== undefined) {
    updates.description = body.description?.toString().trim() || null;
  }
  if (body.accessMode === "everyone" || body.accessMode === "restricted") {
    updates.accessMode = body.accessMode;
  }

  if (Object.keys(updates).length) {
    await db.update(companies).set(updates).where(eq(companies.id, id));
  }

  if (Array.isArray(body.setUsers)) {
    await db.delete(companyAccess).where(eq(companyAccess.companyId, id));
    const rows = body.setUsers
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .map((userEmail) => ({ companyId: id, userEmail }));
    if (rows.length) await db.insert(companyAccess).values(rows).onConflictDoNothing();
  } else {
    if (Array.isArray(body.addUsers) && body.addUsers.length) {
      const rows = body.addUsers
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
        .map((userEmail) => ({ companyId: id, userEmail }));
      if (rows.length) await db.insert(companyAccess).values(rows).onConflictDoNothing();
    }
    if (Array.isArray(body.removeUsers) && body.removeUsers.length) {
      await db
        .delete(companyAccess)
        .where(
          and(
            eq(companyAccess.companyId, id),
            inArray(companyAccess.userEmail, body.removeUsers.map((e) => e.trim().toLowerCase())),
          ),
        );
    }
  }

  const [updated] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return Response.json(updated);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canSeeCompany(user.email, id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(companies).where(eq(companies.id, id));
  return Response.json({ ok: true });
}
