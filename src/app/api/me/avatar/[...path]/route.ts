import { get } from "@vercel/blob";
import { NextRequest } from "next/server";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

interface Params {
  params: Promise<{ path: string[] }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = parseSessionToken(token);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { path } = await params;
  const pathname = path.map((p) => decodeURIComponent(p)).join("/");

  const result = await get(pathname, { access: "private" });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });

  const headers = new Headers();
  for (const [k, v] of result.headers.entries()) headers.set(k, v);
  headers.set("Cache-Control", "private, max-age=86400");
  return new Response(result.stream as unknown as ReadableStream, { headers });
}
