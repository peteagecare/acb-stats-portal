import { NextRequest } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/workspace-auth";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientEmail, user.email))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const unreadCount = rows.filter((r) => r.readAt === null).length;
  return Response.json({ notifications: rows, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  type Body = { markAllRead?: boolean; ids?: string[] };
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

  return Response.json({ ok: true });
}
