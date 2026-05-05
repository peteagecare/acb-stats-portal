import { NextRequest } from "next/server";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { loadUsers } from "@/lib/users";

/** GET /api/users — minimal user directory for any logged-in user.
 *  Used for assignee pickers, filters, and avatars. Excludes secrets. */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = parseSessionToken(token);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await loadUsers();
  return Response.json({
    users: users.map((u) => ({ email: u.email, label: u.label, avatarUrl: u.avatarUrl })),
  });
}
