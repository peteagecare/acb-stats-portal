import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";

const KEY = "reviews.json";
const FALLBACK = "./reviews.json";

interface ReviewSnapshot {
  date: string;
  count: number;
}

interface PlatformData {
  name: string;
  url: string;
  colour: string;
  current: number;
  rating: number;
  history: ReviewSnapshot[];
}

interface ReviewsFile {
  platforms: PlatformData[];
}

async function loadFile(): Promise<ReviewsFile> {
  return loadJson<ReviewsFile>(KEY, FALLBACK, { platforms: [] });
}

async function saveFile(data: ReviewsFile): Promise<void> {
  await saveJson(KEY, FALLBACK, data);
}

async function scrapeTrustpilot(): Promise<{ count: number; rating: number } | null> {
  try {
    const res = await fetch("https://uk.trustpilot.com/review/agecare-bathrooms.co.uk", {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const countMatch = html.match(/(\d+)\s+reviews/);
    const ratingMatch = html.match(/"ratingValue":"([\d.]+)"/);
    if (!countMatch) return null;
    return {
      count: parseInt(countMatch[1], 10),
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : 0,
    };
  } catch {
    return null;
  }
}

async function scrapeReviewsIo(): Promise<{ count: number; rating: number } | null> {
  try {
    const res = await fetch("https://www.reviews.io/company-reviews/store/www.agecare-bathrooms.co.uk", {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const countMatch = html.match(/(\d+)\s+reviews/i);
    const ratingMatch = html.match(/"ratingValue":"([\d.]+)"/);
    if (!countMatch) return null;
    return {
      count: parseInt(countMatch[1], 10),
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : 0,
    };
  } catch {
    return null;
  }
}

async function fetchGoogle(): Promise<{ count: number; rating: number } | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!key || !placeId) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,user_ratings_total&key=${key}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.result) {
      return {
        count: data.result.user_ratings_total ?? 0,
        rating: data.result.rating ?? 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchFacebook(): Promise<{ count: number; rating: number } | null> {
  const token = process.env.FACEBOOK_PAGE_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!token || !pageId) return null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}?fields=overall_star_rating,rating_count&access_token=${token}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      count: data.rating_count ?? 0,
      rating: data.overall_star_rating ?? 0,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const data = await loadFile();
  const from = request.nextUrl.searchParams.get("from");
  const today = new Date().toISOString().split("T")[0];

  // Auto-fetch all platforms
  const [tp, rio, google, fb] = await Promise.all([scrapeTrustpilot(), scrapeReviewsIo(), fetchGoogle(), fetchFacebook()]);

  for (const p of data.platforms) {
    let scraped: { count: number; rating: number } | null = null;
    if (p.name === "Trustpilot") scraped = tp;
    if (p.name === "Reviews.io") scraped = rio;
    if (p.name === "Google") scraped = google;
    if (p.name === "Facebook") scraped = fb;

    if (scraped && scraped.count > 0) {
      // Snapshot history before updating
      if (p.current > 0 && p.current !== scraped.count) {
        if (!p.history.find((h) => h.date === today)) {
          p.history.push({ date: today, count: p.current });
        }
      }
      p.current = scraped.count;
      p.rating = scraped.rating;
    }
  }

  await saveFile(data);

  // Build response
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
      rating: p.rating,
      increase: p.history.length > 0 ? p.current - periodStart : null,
    };
  });

  const totalReviews = platforms.reduce((s, p) => s + p.total, 0);
  const totalIncrease = platforms.filter((p) => p.increase !== null).reduce((s, p) => s + (p.increase ?? 0), 0);

  return Response.json({ platforms, totalReviews, totalIncrease });
}

// POST to manually update Google/Facebook counts
export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = await loadFile();
  const today = new Date().toISOString().split("T")[0];

  if (body.name && body.current != null) {
    const platform = data.platforms.find((p) => p.name === body.name);
    if (platform) {
      if (platform.current > 0 && platform.current !== body.current) {
        if (!platform.history.find((h) => h.date === today)) {
          platform.history.push({ date: today, count: platform.current });
        }
      }
      platform.current = body.current;
      if (body.rating != null) platform.rating = body.rating;
      await saveFile(data);
      return Response.json({ ok: true });
    }
  }

  return Response.json({ error: "Invalid" }, { status: 400 });
}
