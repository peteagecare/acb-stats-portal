import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { CalendarPlatform, isPlatform } from "@/lib/content-calendar";

const KEY = "content-ideas.json";
const FALLBACK = "./content-ideas.json";

export interface ContentIdea {
  id: string;
  title: string;
  notes?: string;
  /** Optional preferred platform — used to find the next matching slot. */
  platform?: CalendarPlatform;
  createdAt: string;
  createdBy: string;
}

interface IdeasFile {
  ideas: ContentIdea[];
}

const DEFAULT: IdeasFile = { ideas: [] };

async function load(): Promise<IdeasFile> {
  return loadJson<IdeasFile>(KEY, FALLBACK, DEFAULT);
}
async function save(d: IdeasFile): Promise<void> {
  await saveJson(KEY, FALLBACK, d);
}
function requireAuth(request: NextRequest): { email: string } | null {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  return user ? { email: user.email } : null;
}

export async function GET() {
  const data = await load();
  return Response.json(data);
}

export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as { title?: string; notes?: string; platform?: string };
  const title = (body.title ?? "").trim();
  if (!title) return Response.json({ error: "Title required" }, { status: 400 });
  const data = await load();
  const idea: ContentIdea = {
    id: crypto.randomUUID(),
    title,
    notes: body.notes?.trim() || undefined,
    platform: body.platform && isPlatform(body.platform) ? body.platform : undefined,
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
  const body = (await request.json()) as { id?: string; title?: string; notes?: string; platform?: string | null };
  if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
  const data = await load();
  const idx = data.ideas.findIndex((i) => i.id === body.id);
  if (idx < 0) return Response.json({ error: "Not found" }, { status: 404 });
  if (typeof body.title === "string") data.ideas[idx].title = body.title.trim() || data.ideas[idx].title;
  if (body.notes !== undefined) data.ideas[idx].notes = body.notes.trim() || undefined;
  if (body.platform !== undefined) {
    data.ideas[idx].platform =
      body.platform && isPlatform(body.platform) ? body.platform : undefined;
  }
  await save(data);
  return Response.json(data.ideas[idx]);
}
