import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/db/client";
import { attachments } from "@/db/schema";
import { requireUser, canSeeParent } from "@/lib/workspace-auth";

interface Params { params: Promise<{ id: string }>; }

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [att] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
  if (!att) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await canSeeParent(user.email, att.parentType, att.parentId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (att.storage === "blob" && att.url) {
    try {
      await del(att.url);
    } catch (e) {
      console.error("[attachments] blob delete failed:", e);
    }
  }

  await db.delete(attachments).where(eq(attachments.id, id));
  return Response.json({ ok: true });
}
