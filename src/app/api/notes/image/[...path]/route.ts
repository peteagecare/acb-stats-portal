import { get } from "@vercel/blob";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/workspace-auth";

interface Params {
  params: Promise<{ path: string[] }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { path } = await params;
  const pathname = path.map((p) => decodeURIComponent(p)).join("/");

  const result = await get(pathname, { access: "private" });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });

  const headers = new Headers();
  for (const [k, v] of result.headers.entries()) headers.set(k, v);
  // Cache in the browser since these are immutable once uploaded
  headers.set("Cache-Control", "private, max-age=86400");
  return new Response(result.stream as unknown as ReadableStream, { headers });
}
