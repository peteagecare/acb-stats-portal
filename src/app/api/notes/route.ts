import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { meetingNotes } from "@/db/schema";
import { requireUser } from "@/lib/workspace-auth";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(meetingNotes)
    .where(eq(meetingNotes.authorEmail, user.email))
    .orderBy(desc(meetingNotes.updatedAt));

  return Response.json({ notes: rows });
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  type Body = { title?: string; body?: string; meetingDate?: string | null };
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const [created] = await db
    .insert(meetingNotes)
    .values({
      title: body.title?.trim() || "",
      body: body.body ?? "",
      meetingDate: body.meetingDate || null,
      authorEmail: user.email,
    })
    .returning();

  return Response.json(created);
}
