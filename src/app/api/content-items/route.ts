import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

const KEY = "content-items.json";
const FALLBACK = "./content-items.json";

export type ContentItemType = "facebook" | "instagram" | "blog";

export interface ContentItem {
  id: string;
  type: ContentItemType;
  title: string;
  url: string;
  notes?: string;
  submittedBy: string;
  submittedByLabel: string;
  submittedAt: string;
  updatedAt?: string;
}

const ALLOWED_TYPES: ContentItemType[] = ["facebook", "instagram", "blog"];

function isValidType(v: unknown): v is ContentItemType {
  return typeof v === "string" && (ALLOWED_TYPES as string[]).includes(v);
}

function isValidUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function newId(): string {
  return `ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function read(): Promise<ContentItem[]> {
  return loadJson<ContentItem[]>(KEY, FALLBACK, []);
}

async function write(items: ContentItem[]): Promise<void> {
  await saveJson(KEY, FALLBACK, items);
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const items = await read();
  return Response.json({ items });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { type?: unknown; title?: unknown; url?: unknown; notes?: unknown; label?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidType(body.type)) {
    return Response.json({ error: "type must be facebook, instagram or blog" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!title) return Response.json({ error: "title required" }, { status: 400 });
  if (!url || !isValidUrl(url)) {
    return Response.json({ error: "url must be a valid http(s) link" }, { status: 400 });
  }
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : user.email;

  const item: ContentItem = {
    id: newId(),
    type: body.type,
    title,
    url,
    notes: notes || undefined,
    submittedBy: user.email,
    submittedByLabel: label,
    submittedAt: new Date().toISOString(),
  };

  const items = await read();
  items.push(item);
  await write(items);
  return Response.json({ item, items });
}

export async function PATCH(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { id?: unknown; title?: unknown; url?: unknown; notes?: unknown; type?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const items = await read();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return Response.json({ error: "not found" }, { status: 404 });

  const current = items[idx];
  if (current.submittedBy.toLowerCase() !== user.email.toLowerCase()) {
    return Response.json({ error: "only the submitter can edit this item" }, { status: 403 });
  }

  const next: ContentItem = { ...current };

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return Response.json({ error: "title cannot be empty" }, { status: 400 });
    next.title = title;
  }
  if (body.url !== undefined) {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url || !isValidUrl(url)) {
      return Response.json({ error: "url must be a valid http(s) link" }, { status: 400 });
    }
    next.url = url;
  }
  if (body.notes !== undefined) {
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    next.notes = notes || undefined;
  }
  if (body.type !== undefined) {
    if (!isValidType(body.type)) {
      return Response.json({ error: "invalid type" }, { status: 400 });
    }
    next.type = body.type;
  }

  next.updatedAt = new Date().toISOString();
  items[idx] = next;
  await write(items);
  return Response.json({ item: next, items });
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const items = await read();
  const target = items.find((i) => i.id === id);
  if (!target) return Response.json({ error: "not found" }, { status: 404 });
  if (target.submittedBy.toLowerCase() !== user.email.toLowerCase()) {
    return Response.json({ error: "only the submitter can delete this item" }, { status: 403 });
  }

  const filtered = items.filter((i) => i.id !== id);
  await write(filtered);
  return Response.json({ items: filtered });
}
