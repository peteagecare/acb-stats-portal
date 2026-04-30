import { NextRequest } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { comments } from "@/db/schema";
import { requireUser, canSeeParent, ParentType } from "@/lib/workspace-auth";

function isParentType(v: unknown): v is ParentType {
  return v === "project" || v === "task";
}

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parentType = searchParams.get("parentType");
  const parentId = searchParams.get("parentId");
  if (!isParentType(parentType) || !parentId) {
    return Response.json({ error: "parentType and parentId required" }, { status: 400 });
  }
  if (!(await canSeeParent(user.email, parentType, parentId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(comments)
    .where(and(eq(comments.parentType, parentType), eq(comments.parentId, parentId)))
    .orderBy(asc(comments.createdAt));
  return Response.json({ comments: rows });
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { parentType?: string; parentId?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isParentType(body.parentType) || !body.parentId) {
    return Response.json({ error: "parentType and parentId required" }, { status: 400 });
  }
  const text = (body.body ?? "").trim();
  if (!text) return Response.json({ error: "Comment cannot be empty" }, { status: 400 });

  if (!(await canSeeParent(user.email, body.parentType, body.parentId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [created] = await db
    .insert(comments)
    .values({
      parentType: body.parentType,
      parentId: body.parentId,
      body: text,
      authorEmail: user.email,
    })
    .returning();
  return Response.json(created);
}
