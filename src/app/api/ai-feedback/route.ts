import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const FEEDBACK_PATH = path.resolve("./ai-feedback.json");

interface FeedbackFile {
  rejected: string[];
  accepted: string[];
}

function loadFile(): FeedbackFile {
  try { return JSON.parse(fs.readFileSync(FEEDBACK_PATH, "utf-8")); }
  catch { return { rejected: [], accepted: [] }; }
}

function saveFile(data: FeedbackFile) {
  fs.writeFileSync(FEEDBACK_PATH, JSON.stringify(data, null, 2));
}

export async function GET() {
  return Response.json(loadFile());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = loadFile();

  if (body.rejected) {
    data.rejected.push(body.rejected);
    saveFile(data);
  }
  if (body.accepted) {
    data.accepted.push(body.accepted);
    saveFile(data);
  }

  return Response.json({ ok: true });
}
