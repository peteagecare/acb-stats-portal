import { put } from "@vercel/blob";
import { NextRequest } from "next/server";
import { canSeeParent, requireUser, type ParentType } from "@/lib/workspace-auth";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];

function isParentType(v: unknown): v is ParentType {
  return v === "project" || v === "task";
}

export async function POST(request: NextRequest): Promise<Response> {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const parentType = form.get("parentType");
  const parentId = form.get("parentId");

  if (!(file instanceof File)) return Response.json({ error: "file required" }, { status: 400 });
  if (!isParentType(parentType)) return Response.json({ error: "parentType must be project or task" }, { status: 400 });
  if (typeof parentId !== "string" || !parentId) return Response.json({ error: "parentId required" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: `Max ${MAX_BYTES / 1024 / 1024}MB` }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return Response.json({ error: "Unsupported image type" }, { status: 400 });
  if (!(await canSeeParent(user.email, parentType, parentId))) {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  // Sanitize filename — strip leading/trailing whitespace, collapse internal whitespace.
  const safeName = (file.name || "image").trim().replace(/\s+/g, "-");
  const blob = await put(`inline/${parentType}/${parentId}/${safeName}`, file, {
    access: "private",
    addRandomSuffix: true,
    contentType: file.type,
  });

  // Serve via auth-checked proxy (matches the notes pattern).
  const proxyUrl = `/api/inline-images/${blob.pathname}`;
  return Response.json({ url: proxyUrl });
}
