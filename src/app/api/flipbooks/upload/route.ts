import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/workspace-auth";

export const runtime = "nodejs";

const MAX_BYTES = 200 * 1024 * 1024;

const PATHNAME_RE =
  /^flipbooks\/[A-Za-z0-9_-]{4,30}\/(source\.pdf|pages\/page-\d+\.png|gifs\/[A-Za-z0-9_.-]+)$/;

export async function POST(request: NextRequest): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  // Token-generation requests come with the user's session cookie. The
  // upload-completed callback comes from Vercel itself (HMAC verified by
  // handleUpload), so we only enforce user auth for the first leg.
  if (body.type === "blob.generate-client-token") {
    const user = requireUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!PATHNAME_RE.test(pathname)) {
          throw new Error("Invalid pathname");
        }
        return {
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // No-op; manifest creation happens via /api/flipbooks once all uploads land.
      },
    });
    return Response.json(jsonResponse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    console.error("[flipbooks/upload]", err);
    return Response.json({ error: msg }, { status: 400 });
  }
}
