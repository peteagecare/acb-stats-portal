import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest } from "next/server";
import { requireUser, canSeeParent, ParentType } from "@/lib/workspace-auth";

const MAX_BYTES = 25 * 1024 * 1024;

function isParentType(v: unknown): v is ParentType {
  return v === "project" || v === "task";
}

export async function POST(request: NextRequest): Promise<Response> {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let parsed: { parentType?: string; parentId?: string } = {};
        try {
          parsed = clientPayload ? JSON.parse(clientPayload) : {};
        } catch {
          throw new Error("Invalid clientPayload");
        }
        if (!isParentType(parsed.parentType) || !parsed.parentId) {
          throw new Error("parentType and parentId required");
        }
        if (!(await canSeeParent(user.email, parsed.parentType, parsed.parentId))) {
          throw new Error("Not allowed");
        }
        return {
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: clientPayload,
        };
      },
      // Local dev skips this callback; the client registers the attachment via
      // POST /api/attachments after upload completes. Production will hit this
      // too — both paths are idempotent on (url) implicitly.
      onUploadCompleted: async () => {
        /* no-op; registration handled by client after upload */
      },
    });
    return Response.json(jsonResponse);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 },
    );
  }
}
