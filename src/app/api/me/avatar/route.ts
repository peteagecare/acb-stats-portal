import { NextRequest } from "next/server";
import { put, del } from "@vercel/blob";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { loadUsers, saveUsers } from "@/lib/users";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = parseSessionToken(token);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: `Image too large (max ${MAX_BYTES / 1024 / 1024}MB)` }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return Response.json({ error: "Image must be PNG, JPEG, WebP, or GIF" }, { status: 400 });
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const safeEmail = session.email.replace(/[^a-z0-9]/gi, "_");
  const blob = await put(`avatars/${safeEmail}-${Date.now()}.${ext}`, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
  });

  const users = await loadUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === session.email.toLowerCase());
  if (idx === -1) return Response.json({ error: "User not found" }, { status: 404 });

  const previous = users[idx].avatarUrl;
  users[idx] = { ...users[idx], avatarUrl: blob.url };
  await saveUsers(users);

  // Best-effort cleanup of the prior file so old avatars don't accumulate
  if (previous && previous !== blob.url) {
    del(previous).catch(() => {});
  }

  return Response.json({ avatarUrl: blob.url });
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = parseSessionToken(token);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const users = await loadUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === session.email.toLowerCase());
  if (idx === -1) return Response.json({ error: "User not found" }, { status: 404 });

  const previous = users[idx].avatarUrl;
  if (!previous) return Response.json({ ok: true });

  users[idx] = { ...users[idx], avatarUrl: undefined };
  await saveUsers(users);

  del(previous).catch(() => {});
  return Response.json({ ok: true });
}
