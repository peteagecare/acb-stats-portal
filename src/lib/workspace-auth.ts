import { NextRequest } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/db/client";
import {
  companies,
  projects,
  companyAccess,
  projectAccess,
  tasks,
} from "@/db/schema";

export function requireUser(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  return parseSessionToken(token);
}

/** Returns the set of company IDs a user can see. */
export async function visibleCompanyIds(email: string): Promise<Set<string>> {
  const all = await db
    .select({ id: companies.id, accessMode: companies.accessMode })
    .from(companies);
  const grants = await db
    .select({ companyId: companyAccess.companyId })
    .from(companyAccess)
    .where(eq(companyAccess.userEmail, email));
  const grantedIds = new Set(grants.map((g) => g.companyId));
  const visible = new Set<string>();
  for (const c of all) {
    if (c.accessMode === "everyone" || grantedIds.has(c.id)) visible.add(c.id);
  }
  return visible;
}

/** Returns the set of project IDs the user can see (within visible companies). */
export async function visibleProjectIds(email: string): Promise<Set<string>> {
  const companyIds = await visibleCompanyIds(email);
  if (companyIds.size === 0) return new Set();

  const all = await db
    .select({ id: projects.id, companyId: projects.companyId, accessMode: projects.accessMode })
    .from(projects)
    .where(inArray(projects.companyId, [...companyIds]));

  const grants = await db
    .select({ projectId: projectAccess.projectId })
    .from(projectAccess)
    .where(eq(projectAccess.userEmail, email));
  const grantedIds = new Set(grants.map((g) => g.projectId));

  const visible = new Set<string>();
  for (const p of all) {
    if (p.accessMode === "everyone" || grantedIds.has(p.id)) visible.add(p.id);
  }
  return visible;
}

export async function canSeeCompany(email: string, companyId: string): Promise<boolean> {
  const [company] = await db
    .select({ accessMode: companies.accessMode })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company) return false;
  if (company.accessMode === "everyone") return true;
  const [grant] = await db
    .select({ userEmail: companyAccess.userEmail })
    .from(companyAccess)
    .where(and(eq(companyAccess.companyId, companyId), eq(companyAccess.userEmail, email)))
    .limit(1);
  return !!grant;
}

export async function canSeeProject(email: string, projectId: string): Promise<boolean> {
  const [project] = await db
    .select({
      id: projects.id,
      companyId: projects.companyId,
      accessMode: projects.accessMode,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return false;
  const companyOk = await canSeeCompany(email, project.companyId);
  if (!companyOk) return false;
  if (project.accessMode === "everyone") return true;
  const [grant] = await db
    .select({ userEmail: projectAccess.userEmail })
    .from(projectAccess)
    .where(and(eq(projectAccess.projectId, projectId), eq(projectAccess.userEmail, email)))
    .limit(1);
  return !!grant;
}

export type ParentType = "project" | "task";

/** Check that the user can see a parent entity (project or task). */
export async function canSeeParent(
  email: string,
  parentType: ParentType,
  parentId: string,
): Promise<boolean> {
  if (parentType === "project") return canSeeProject(email, parentId);
  const [task] = await db
    .select({ projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.id, parentId))
    .limit(1);
  if (!task) return false;
  return canSeeProject(email, task.projectId);
}
