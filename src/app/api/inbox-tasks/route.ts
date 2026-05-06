import { NextRequest } from "next/server";
import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { inboxTasks } from "@/db/schema";
import { requireUser } from "@/lib/workspace-auth";

/** Quick Inbox: per-user list of unsorted to-dos that aren't tied to a project.
 *  Owner is the caller; tasks are private to whoever created them. */
export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(inboxTasks)
    .where(and(eq(inboxTasks.ownerEmail, user.email), eq(inboxTasks.completed, false)))
    .orderBy(asc(inboxTasks.order), desc(inboxTasks.createdAt));

  return Response.json({ tasks: rows });
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; endDate?: string | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const title = (body.title ?? "").trim();
  if (!title) return Response.json({ error: "Title required" }, { status: 400 });

  const [last] = await db
    .select({ order: inboxTasks.order })
    .from(inboxTasks)
    .where(eq(inboxTasks.ownerEmail, user.email))
    .orderBy(desc(inboxTasks.order))
    .limit(1);
  const nextOrder = (last?.order ?? -1) + 1;

  const [created] = await db
    .insert(inboxTasks)
    .values({
      title,
      ownerEmail: user.email,
      endDate: body.endDate || null,
      order: nextOrder,
      createdByEmail: user.email,
    })
    .returning();

  return Response.json(created);
}
