import { put } from "@vercel/blob";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/workspace-auth";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];

export async function POST(request: NextRequest): Promise<Response> {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const noteId = form.get("noteId");
  if (!(file instanceof File)) return Response.json({ error: "file required" }, { status: 400 });
  if (typeof noteId !== "string" || !noteId) return Response.json({ error: "noteId required" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: `Max ${MAX_BYTES / 1024 / 1024}MB` }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return Response.json({ error: "Unsupported image type" }, { status: 400 });

  const blob = await put(`notes/${noteId}/${file.name}`, file, {
    access: "private",
    addRandomSuffix: true,
    contentType: file.type,
  });

  // Return a proxy URL so the browser can fetch the bytes via our auth-checked route
  const proxyUrl = `/api/notes/image/${blob.pathname}`;
  return Response.json({ url: proxyUrl });
}
