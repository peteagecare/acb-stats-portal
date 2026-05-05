import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

const KEY = "smt-spend-settings.json";
const FALLBACK = "./smt-spend-settings.json";

interface SmtSpendSettings {
  tvMonthlySpend: number;
}

const DEFAULTS: SmtSpendSettings = {
  tvMonthlySpend: 24600,
};

export async function GET() {
  const stored = await loadJson<Partial<SmtSpendSettings>>(KEY, FALLBACK, DEFAULTS);
  return Response.json({ ...DEFAULTS, ...stored });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  const body = (await request.json()) as Partial<SmtSpendSettings>;
  const current = await loadJson<Partial<SmtSpendSettings>>(KEY, FALLBACK, DEFAULTS);
  const updated: SmtSpendSettings = { ...DEFAULTS, ...current };
  if (typeof body.tvMonthlySpend === "number" && body.tvMonthlySpend >= 0) {
    updated.tvMonthlySpend = body.tvMonthlySpend;
  }
  await saveJson(KEY, FALLBACK, updated);
  return Response.json(updated);
}
