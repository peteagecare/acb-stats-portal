import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";

const KEY = "ai-feedback.json";
const FALLBACK = "./ai-feedback.json";

interface FeedbackFile {
  rejected: string[];
  accepted: string[];
}

const DEFAULT: FeedbackFile = { rejected: [], accepted: [] };

async function loadFile(): Promise<FeedbackFile> {
  return loadJson<FeedbackFile>(KEY, FALLBACK, DEFAULT);
}

async function saveFile(data: FeedbackFile): Promise<void> {
  await saveJson(KEY, FALLBACK, data);
}

export async function GET() {
  return Response.json(await loadFile());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = await loadFile();

  if (body.rejected) {
    data.rejected.push(body.rejected);
    await saveFile(data);
  }
  if (body.accepted) {
    data.accepted.push(body.accepted);
    await saveFile(data);
  }

  return Response.json({ ok: true });
}
