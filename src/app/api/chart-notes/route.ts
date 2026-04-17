import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

const KEY = "chart-notes.json";
const FALLBACK = "./chart-notes.json";

export interface ChartNote {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  author: string;
  createdAt: string;
}

// Older notes may not have an id — assign one so the client can target them individually.
function withIds(notes: ChartNote[]): ChartNote[] {
  let mutated = false;
  const out = notes.map((n) => {
    if (n.id) return n;
    mutated = true;
    return { ...n, id: `${n.date}-${n.createdAt || Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  });
  return mutated ? out : notes;
}

export async function GET() {
  const notes = withIds(await loadJson<ChartNote[]>(KEY, FALLBACK, []));
  return Response.json({ notes });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { date, text } = body as { date?: string; text?: string };

  if (!date || !text?.trim()) {
    return Response.json({ error: "date and text are required" }, { status: 400 });
  }

  const notes = withIds(await loadJson<ChartNote[]>(KEY, FALLBACK, []));
  const note: ChartNote = {
    id: `${date}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    text: text.trim(),
    author: user.email,
    createdAt: new Date().toISOString(),
  };
  notes.push(note);

  await saveJson(KEY, FALLBACK, notes);
  return Response.json({ notes });
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const date = searchParams.get("date");
  if (!id && !date) {
    return Response.json({ error: "id or date is required" }, { status: 400 });
  }

  const notes = withIds(await loadJson<ChartNote[]>(KEY, FALLBACK, []));
  const filtered = id
    ? notes.filter((n) => n.id !== id)
    : notes.filter((n) => n.date !== date);
  await saveJson(KEY, FALLBACK, filtered);
  return Response.json({ notes: filtered });
}
