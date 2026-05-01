import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationPrefs } from "@/db/schema";
import { requireUser } from "@/lib/workspace-auth";

const DEFAULTS = {
  mentionsEmail: true,
  mentionsInApp: true,
  taskAssignEmail: true,
  taskAssignInApp: true,
  workspaceTaskAssignEmail: true,
  workspaceTaskAssignInApp: true,
};

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select()
    .from(notificationPrefs)
    .where(eq(notificationPrefs.userEmail, user.email))
    .limit(1);
  return Response.json(row ?? { userEmail: user.email, ...DEFAULTS });
}

export async function PATCH(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  type Body = Partial<typeof DEFAULTS>;
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Body = {};
  for (const k of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) {
    if (typeof body[k] === "boolean") updates[k] = body[k];
  }

  await db
    .insert(notificationPrefs)
    .values({ userEmail: user.email, ...DEFAULTS, ...updates })
    .onConflictDoUpdate({
      target: notificationPrefs.userEmail,
      set: updates,
    });

  const [row] = await db
    .select()
    .from(notificationPrefs)
    .where(eq(notificationPrefs.userEmail, user.email))
    .limit(1);
  return Response.json(row);
}
