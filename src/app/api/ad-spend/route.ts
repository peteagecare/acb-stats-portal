import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const SPEND_PATH = path.resolve("./ad-spend.json");

interface Platform {
  name: string;
  colour: string;
  spend: number;
  clicks: number;
  auto: boolean;
}

interface SpendFile { platforms: Platform[] }

function loadFile(): SpendFile {
  try { return JSON.parse(fs.readFileSync(SPEND_PATH, "utf-8")); }
  catch { return { platforms: [] }; }
}

function saveFile(data: SpendFile) {
  fs.writeFileSync(SPEND_PATH, JSON.stringify(data, null, 2));
}

export async function GET() {
  const data = loadFile();

  const totalSpend = data.platforms.reduce((s, p) => s + p.spend, 0);
  const totalClicks = data.platforms.reduce((s, p) => s + p.clicks, 0);

  return Response.json({
    platforms: data.platforms,
    totalSpend,
    totalClicks,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = loadFile();

  if (body.name) {
    const platform = data.platforms.find((p) => p.name === body.name);
    if (platform) {
      if (body.spend != null) platform.spend = body.spend;
      if (body.clicks != null) platform.clicks = body.clicks;
      saveFile(data);
      return Response.json({ ok: true });
    }
  }

  return Response.json({ error: "Invalid" }, { status: 400 });
}
