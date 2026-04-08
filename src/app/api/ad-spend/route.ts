import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";

const KEY = "ad-spend.json";
const FALLBACK = "./ad-spend.json";

interface Platform {
  name: string;
  colour: string;
  spend: number;
  clicks: number;
  auto: boolean;
}

interface SpendFile { platforms: Platform[] }

const DEFAULT: SpendFile = { platforms: [] };

async function loadFile(): Promise<SpendFile> {
  return loadJson<SpendFile>(KEY, FALLBACK, DEFAULT);
}

async function saveFile(data: SpendFile): Promise<void> {
  await saveJson(KEY, FALLBACK, data);
}

export async function GET() {
  const data = await loadFile();

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
  const data = await loadFile();

  if (body.name) {
    const platform = data.platforms.find((p) => p.name === body.name);
    if (platform) {
      if (body.spend != null) platform.spend = body.spend;
      if (body.clicks != null) platform.clicks = body.clicks;
      await saveFile(data);
      return Response.json({ ok: true });
    }
  }

  return Response.json({ error: "Invalid" }, { status: 400 });
}
