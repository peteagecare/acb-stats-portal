import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { CalendarPlatform, arePlatforms, migratePlatformValue } from "@/lib/content-calendar";

const KEY = "content-ideas.json";
const FALLBACK = "./content-ideas.json";

export interface ContentIdea {
  id: string;
  title: string;
  notes?: string;
  /** Optional preferred platforms — used to find the next matching slot. */
  platforms?: CalendarPlatform[];
  /** Rich-text HTML body — long-form notes about the idea. */
  content?: string;
  createdAt: string;
  createdBy: string;
}

interface IdeasFile {
  ideas: ContentIdea[];
}

const DEFAULT: IdeasFile = { ideas: [] };

function migrateIdea(raw: unknown): ContentIdea | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown> & { platform?: unknown; platforms?: unknown };
  if (typeof r.id !== "string" || typeof r.title !== "string") return null;
  let platforms: CalendarPlatform[] | undefined;
  if (arePlatforms(r.platforms)) {
    platforms = r.platforms;
  } else if (r.platform !== undefined || r.platforms !== undefined) {
    const migrated = migratePlatformValue(r.platform ?? r.platforms);
    platforms = migrated.platforms.length > 0 ? migrated.platforms : undefined;
  }
  return {
    id: r.id,
    title: r.title,
    notes: typeof r.notes === "string" ? r.notes : undefined,
    platforms,
    content: typeof r.content === "string" ? r.content : undefined,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
    createdBy: typeof r.createdBy === "string" ? r.createdBy : "",
  };
}

async function load(): Promise<IdeasFile> {
  const stored = await loadJson<IdeasFile>(KEY, FALLBACK, DEFAULT);
  const rawIdeas = Array.isArray((stored as unknown as { ideas?: unknown }).ideas)
    ? (stored as unknown as { ideas: unknown[] }).ideas
    : [];
  return {
    ideas: rawIdeas
      .map(migrateIdea)
      .filter((i): i is ContentIdea => i !== null),
  };
}
async function save(d: IdeasFile): Promise<void> {
  await saveJson(KEY, FALLBACK, d);
}
function requireAuth(request: NextRequest): { email: string } | null {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  return user ? { email: user.email } : null;
}

function readPlatformsField(value: unknown): CalendarPlatform[] | undefined {
  if (value === null) return undefined;
  if (arePlatforms(value)) return Array.from(new Set(value));
  if (Array.isArray(value) && value.length === 0) return undefined;
  return undefined;
}

export async function GET() {
  const data = await load();
  return Response.json(data);
}

export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as { title?: string; notes?: string; platforms?: unknown };
  const title = (body.title ?? "").trim();
  if (!title) return Response.json({ error: "Title required" }, { status: 400 });
  const data = await load();
  const idea: ContentIdea = {
    id: crypto.randomUUID(),
    title,
    notes: body.notes?.trim() || undefined,
    platforms: readPlatformsField(body.platforms),
    createdAt: new Date().toISOString(),
    createdBy: user.email,
  };
  data.ideas.unshift(idea);
  await save(data);
  return Response.json(idea);
}

export async function DELETE(request: NextRequest) {
  const user = requireAuth(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const data = await load();
  const before = data.ideas.length;
  data.ideas = data.ideas.filter((i) => i.id !== id);
  if (data.ideas.length === before) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  await save(data);
  return Response.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const user = requireAuth(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as {
    id?: string;
    title?: string;
    notes?: string;
    platforms?: unknown;
    content?: string;
  };
  if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
  const data = await load();
  const idx = data.ideas.findIndex((i) => i.id === body.id);
  if (idx < 0) return Response.json({ error: "Not found" }, { status: 404 });
  if (typeof body.title === "string") data.ideas[idx].title = body.title.trim() || data.ideas[idx].title;
  if (body.notes !== undefined) data.ideas[idx].notes = body.notes.trim() || undefined;
  if (body.platforms !== undefined) {
    data.ideas[idx].platforms = readPlatformsField(body.platforms);
  }
  if (typeof body.content === "string") data.ideas[idx].content = body.content;
  await save(data);
  return Response.json(data.ideas[idx]);
}
