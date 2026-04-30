import { NextRequest } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { attachments } from "@/db/schema";
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
    .from(attachments)
    .where(and(eq(attachments.parentType, parentType), eq(attachments.parentId, parentId)))
    .orderBy(desc(attachments.uploadedAt));
  return Response.json({ attachments: rows });
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  type Body = {
    parentType?: string;
    parentId?: string;
    storage?: "blob" | "external";
    filename?: string;
    url?: string;
    blobKey?: string;
    sizeBytes?: number;
    contentType?: string;
  };
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isParentType(body.parentType) || !body.parentId) {
    return Response.json({ error: "parentType and parentId required" }, { status: 400 });
  }
  if (body.storage !== "blob" && body.storage !== "external") {
    return Response.json({ error: "storage must be blob|external" }, { status: 400 });
  }
  const filename = (body.filename ?? "").trim();
  const url = (body.url ?? "").trim();
  if (!filename || !url) {
    return Response.json({ error: "filename and url required" }, { status: 400 });
  }

  if (!(await canSeeParent(user.email, body.parentType, body.parentId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Idempotency: if the same parent + url already exists, return it
  const existing = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.parentType, body.parentType),
        eq(attachments.parentId, body.parentId),
        eq(attachments.url, url),
      ),
    )
    .limit(1);
  if (existing[0]) return Response.json(existing[0]);

  const [created] = await db
    .insert(attachments)
    .values({
      parentType: body.parentType,
      parentId: body.parentId,
      storage: body.storage,
      filename,
      url,
      blobKey: body.blobKey ?? null,
      sizeBytes: body.sizeBytes ?? null,
      contentType: body.contentType ?? null,
      uploadedByEmail: user.email,
    })
    .returning();
  return Response.json(created);
}
