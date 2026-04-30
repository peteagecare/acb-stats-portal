import { NextRequest } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { companies, projects } from "@/db/schema";
import { requireUser, visibleCompanyIds } from "@/lib/workspace-auth";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ids = await visibleCompanyIds(user.email);
  if (ids.size === 0) return Response.json({ companies: [] });

  const rows = await db
    .select()
    .from(companies)
    .where(inArray(companies.id, [...ids]));

  // Project counts per company
  const projectRows = await db
    .select({ id: projects.id, companyId: projects.companyId })
    .from(projects)
    .where(inArray(projects.companyId, [...ids]));
  const counts = new Map<string, number>();
  for (const p of projectRows) counts.set(p.companyId, (counts.get(p.companyId) ?? 0) + 1);

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return Response.json({
    companies: rows.map((c) => ({ ...c, projectCount: counts.get(c.id) ?? 0 })),
  });
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) return Response.json({ error: "Name required" }, { status: 400 });

  const [created] = await db
    .insert(companies)
    .values({
      name,
      description: body.description?.trim() || null,
      createdByEmail: user.email,
    })
    .returning();

  return Response.json(created);
}
