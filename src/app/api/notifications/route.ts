import { NextRequest } from "next/server";
import { and, desc, eq, isNotNull, isNull, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/workspace-auth";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  // include=all → archived + non-archived. Default → non-archived only (bell + main list).
  // include=archived → only archived rows.
  const include = searchParams.get("include") ?? "active";

  const where =
    include === "all"
      ? eq(notifications.recipientEmail, user.email)
      : include === "archived"
        ? and(eq(notifications.recipientEmail, user.email), isNotNull(notifications.archivedAt))
        : and(eq(notifications.recipientEmail, user.email), isNull(notifications.archivedAt));

  const rows = await db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(include === "active" ? 50 : 200);

  // Unread count: never includes archived rows.
  const unreadCount = rows.filter((r) => r.readAt === null && r.archivedAt === null).length;
  return Response.json({ notifications: rows, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  type Body = {
    markAllRead?: boolean;
    archiveAllRead?: boolean;
    archiveIds?: string[];
    restoreIds?: string[];
  };
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const now = new Date();

  if (body.markAllRead) {
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.recipientEmail, user.email), isNull(notifications.readAt)));
  }

  if (body.archiveAllRead) {
    await db
      .update(notifications)
      .set({ archivedAt: now })
      .where(and(
        eq(notifications.recipientEmail, user.email),
        isNotNull(notifications.readAt),
        isNull(notifications.archivedAt),
      ));
  }

  if (body.archiveIds && body.archiveIds.length > 0) {
    await db
      .update(notifications)
      .set({ archivedAt: now, readAt: now })
      .where(and(
        eq(notifications.recipientEmail, user.email),
        inArray(notifications.id, body.archiveIds),
      ));
  }

  if (body.restoreIds && body.restoreIds.length > 0) {
    await db
      .update(notifications)
      .set({ archivedAt: null })
      .where(and(
        eq(notifications.recipientEmail, user.email),
        inArray(notifications.id, body.restoreIds),
      ));
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "archived";
  if (!all) {
    return Response.json({ error: "Refusing — pass ?all=archived to delete all archived rows" }, { status: 400 });
  }

  await db
    .delete(notifications)
    .where(and(
      eq(notifications.recipientEmail, user.email),
      isNotNull(notifications.archivedAt),
    ));

  return Response.json({ ok: true });
}
