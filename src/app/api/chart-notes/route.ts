import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

const KEY = "chart-notes.json";
const FALLBACK = "./chart-notes.json";

export interface ChartNote {
  date: string; // YYYY-MM-DD
  text: string;
  author: string;
  createdAt: string;
}

export async function GET() {
  const notes = await loadJson<ChartNote[]>(KEY, FALLBACK, []);
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

  const notes = await loadJson<ChartNote[]>(KEY, FALLBACK, []);

  // Upsert — one note per date
  const existing = notes.findIndex((n) => n.date === date);
  const note: ChartNote = {
    date,
    text: text.trim(),
    author: user.email,
    createdAt: new Date().toISOString(),
  };

  if (existing >= 0) {
    notes[existing] = note;
  } else {
    notes.push(note);
  }

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
  const date = searchParams.get("date");
  if (!date) {
    return Response.json({ error: "date is required" }, { status: 400 });
  }

  const notes = await loadJson<ChartNote[]>(KEY, FALLBACK, []);
  const filtered = notes.filter((n) => n.date !== date);
  await saveJson(KEY, FALLBACK, filtered);
  return Response.json({ notes: filtered });
}
