import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";

const KEY = "social.json";
const FALLBACK = "./social.json";

interface Snapshot { date: string; count: number }
interface Platform {
  name: string;
  url: string;
  colour: string;
  current: number;
  auto: boolean;
  history: Snapshot[];
}
interface SocialFile { platforms: Platform[] }

async function loadFile(): Promise<SocialFile> {
  return loadJson<SocialFile>(KEY, FALLBACK, { platforms: [] });
}

async function saveFile(data: SocialFile): Promise<void> {
  await saveJson(KEY, FALLBACK, data);
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";

async function fetchFacebookFollowers(): Promise<number | null> {
  const token = process.env.FACEBOOK_PAGE_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!token || !pageId) return null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}?fields=fan_count&access_token=${token}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const d = await res.json();
    return d.fan_count ?? null;
  } catch { return null; }
}

async function fetchInstagramFollowers(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://www.instagram.com/api/v1/users/web_profile_info/?username=agecarebathrooms",
      { cache: "no-store", headers: { "User-Agent": UA, "x-ig-app-id": "936619743392459" } }
    );
    if (!res.ok) return null;
    const d = await res.json();
    return d?.data?.user?.edge_followed_by?.count ?? null;
  } catch { return null; }
}

async function fetchLinkedInFollowers(): Promise<number | null> {
  try {
    const res = await fetch("https://www.linkedin.com/company/age-care-bathrooms/", {
      cache: "no-store", headers: { "User-Agent": UA },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/([0-9,]+)\s+followers/);
    if (!match) return null;
    return parseInt(match[1].replace(/,/g, ""), 10);
  } catch { return null; }
}

async function fetchTikTokFollowers(): Promise<number | null> {
  try {
    const res = await fetch("https://www.tiktok.com/@agecaregroup", {
      cache: "no-store", headers: { "User-Agent": UA },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/"followerCount":(\d+)/);
    if (!match) return null;
    return parseInt(match[1], 10);
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const data = await loadFile();
  const from = request.nextUrl.searchParams.get("from");
  const today = new Date().toISOString().split("T")[0];

  // Auto-fetch all platforms in parallel
  const [fb, ig, li, tt] = await Promise.all([
    fetchFacebookFollowers(),
    fetchInstagramFollowers(),
    fetchLinkedInFollowers(),
    fetchTikTokFollowers(),
  ]);

  const autoMap: Record<string, number | null> = {
    "Facebook": fb,
    "Instagram": ig,
    "LinkedIn (Business)": li,
    "TikTok": tt,
  };

  for (const p of data.platforms) {
    const newCount = autoMap[p.name] ?? null;
    if (newCount !== null && newCount > 0) {
      if (p.current > 0 && p.current !== newCount && !p.history.find((h) => h.date === today)) {
        p.history.push({ date: today, count: p.current });
      }
      p.current = newCount;
      p.auto = true;
    }
  }
  await saveFile(data);

  const platforms = data.platforms.map((p) => {
    let periodStart = p.current;
    if (from && p.history.length > 0) {
      const sorted = [...p.history].sort((a, b) => a.date.localeCompare(b.date));
      const before = sorted.filter((h) => h.date <= from);
      periodStart = before.length > 0 ? before[before.length - 1].count : sorted[0].count;
    }
    return {
      name: p.name,
      url: p.url,
      colour: p.colour,
      total: p.current,
      auto: p.auto,
      increase: p.history.length > 0 ? p.current - periodStart : null,
    };
  });

  const totalFollowers = platforms.reduce((s, p) => s + p.total, 0);
  return Response.json({ platforms, totalFollowers });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = await loadFile();
  const today = new Date().toISOString().split("T")[0];

  if (body.name && body.current != null) {
    const platform = data.platforms.find((p) => p.name === body.name);
    if (platform) {
      if (platform.current > 0 && platform.current !== body.current && !platform.history.find((h) => h.date === today)) {
        platform.history.push({ date: today, count: platform.current });
      }
      platform.current = body.current;
      await saveFile(data);
      return Response.json({ ok: true });
    }
  }
  return Response.json({ error: "Invalid" }, { status: 400 });
}
