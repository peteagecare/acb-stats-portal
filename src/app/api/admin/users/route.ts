import { NextRequest } from "next/server";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { loadUsers, saveUsers, generateTotpSecret } from "@/lib/users";

function requireAdmin(request: NextRequest): Response | null {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** GET /api/admin/users — list all users (admin only) */
export async function GET(request: NextRequest) {
  const err = requireAdmin(request);
  if (err) return err;

  const users = await loadUsers();
  // Return users without exposing TOTP secrets
  return Response.json({
    users: users.map((u) => ({
      email: u.email,
      label: u.label,
      role: u.role,
      createdAt: u.createdAt,
      avatarUrl: u.avatarUrl,
    })),
  });
}

/** POST /api/admin/users — create a new viewer user (admin only)
 *  Body: { email: string, label: string }
 *  Returns: { user, totpSecret, otpauthUrl } — the secret is shown once for QR code setup
 */
export async function POST(request: NextRequest) {
  const err = requireAdmin(request);
  if (err) return err;

  let body: { email?: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const label = (body.label ?? "").trim();

  if (!email || !label) {
    return Response.json({ error: "Email and name are required." }, { status: 400 });
  }

  const users = await loadUsers();
  if (users.some((u) => u.email.toLowerCase() === email)) {
    return Response.json({ error: "A user with that email already exists." }, { status: 409 });
  }

  const totpSecret = generateTotpSecret();
  const newUser = {
    email,
    label,
    role: "viewer" as const,
    totpSecret,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await saveUsers(users);

  // Build otpauth URL for QR code generation
  const otpauthUrl = `otpauth://totp/ACB%20Stats:${encodeURIComponent(email)}?secret=${totpSecret}&issuer=ACB%20Stats&digits=6&period=30`;

  return Response.json({
    user: { email, label, role: "viewer", createdAt: newUser.createdAt },
    totpSecret,
    otpauthUrl,
  });
}

/** DELETE /api/admin/users — remove a user (admin only)
 *  Body: { email: string }
 */
export async function DELETE(request: NextRequest) {
  const err = requireAdmin(request);
  if (err) return err;

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) {
    return Response.json({ error: "Email is required." }, { status: 400 });
  }

  const users = await loadUsers();
  const target = users.find((u) => u.email.toLowerCase() === email);
  if (!target) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }
  if (target.role === "admin") {
    return Response.json({ error: "Cannot remove the admin user." }, { status: 403 });
  }

  const updated = users.filter((u) => u.email.toLowerCase() !== email);
  await saveUsers(updated);

  return Response.json({ ok: true });
}
