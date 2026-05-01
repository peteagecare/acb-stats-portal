import { NextRequest } from "next/server";
import { asc, sql as rawSql } from "drizzle-orm";
import { db } from "@/db/client";
import { tags } from "@/db/schema";
import { requireUser } from "@/lib/workspace-auth";

const TAG_PALETTE = [
  "#0071E3", "#10B981", "#A855F7", "#F59E0B", "#EC4899",
  "#14B8A6", "#EF4444", "#6366F1", "#84CC16", "#F97316",
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select().from(tags).orderBy(asc(tags.name));
  return Response.json({ tags: rows });
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; color?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name) return Response.json({ error: "Name required" }, { status: 400 });
  if (name.length > 60) return Response.json({ error: "Name too long" }, { status: 400 });

  // Case-insensitive dedupe — return existing if found
  const existing = await db
    .select()
    .from(tags)
    .where(rawSql`lower(${tags.name}) = lower(${name})`)
    .limit(1);
  if (existing[0]) return Response.json(existing[0]);

  const color = body.color && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : colorForName(name);

  const [created] = await db
    .insert(tags)
    .values({ name, color, createdByEmail: user.email })
    .returning();
  return Response.json(created);
}
