import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

const KEY = "subscriptions.json";
const FALLBACK = "./subscriptions.json";

export interface Subscription {
  id: string;
  name: string;
  cost: number;
  currency: "GBP" | "USD" | "EUR";
  frequency: "monthly" | "annual";
  category: string;
  notes: string;
  startDate?: string;
  endDate?: string;
  paymentDay?: number;
  replaceableByAI?: boolean;
}

interface SubscriptionsData {
  items: Subscription[];
  usdToGbp: number;
  eurToGbp: number;
  claudeTeamsPrice: number;
}

const DEFAULTS: SubscriptionsData = { items: [], usdToGbp: 0.79, eurToGbp: 0.86, claudeTeamsPrice: 25 };

export async function GET() {
  const data = await loadJson<SubscriptionsData>(KEY, FALLBACK, DEFAULTS);
  return Response.json({
    items: data.items ?? [],
    usdToGbp: data.usdToGbp ?? DEFAULTS.usdToGbp,
    eurToGbp: data.eurToGbp ?? DEFAULTS.eurToGbp,
    claudeTeamsPrice: data.claudeTeamsPrice ?? DEFAULTS.claudeTeamsPrice,
  });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  const body = await request.json();
  const items: Subscription[] = Array.isArray(body.items) ? body.items : [];
  const usdToGbp: number = typeof body.usdToGbp === "number" ? body.usdToGbp : DEFAULTS.usdToGbp;
  const eurToGbp: number = typeof body.eurToGbp === "number" ? body.eurToGbp : DEFAULTS.eurToGbp;
  const claudeTeamsPrice: number = typeof body.claudeTeamsPrice === "number" ? body.claudeTeamsPrice : DEFAULTS.claudeTeamsPrice;
  await saveJson(KEY, FALLBACK, { items, usdToGbp, eurToGbp, claudeTeamsPrice });
  return Response.json({ items, usdToGbp, eurToGbp, claudeTeamsPrice });
}
