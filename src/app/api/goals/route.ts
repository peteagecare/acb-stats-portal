import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

const KEY = "goals.json";
const FALLBACK = "./goals.json";

const DEFAULT_GOALS = {
  leadGoalPerMonth: null as number | null,
  prospectsGoalPerMonth: null as number | null,
  visitsGoalPerMonth: null as number | null,
  contactsGoalPerMonth: null as number | null,
  siteVisitsGoalPerWeek: null as number | null,
  installsGoalPerMonth: 32 as number | null,
  ppcPercentGoal: null as number | null,
  seoPercentGoal: null as number | null,
  contentPercentGoal: null as number | null,
  otherPercentGoal: null as number | null,
};

type Goals = typeof DEFAULT_GOALS;

export async function GET() {
  const stored = await loadJson<Partial<Goals>>(KEY, FALLBACK, DEFAULT_GOALS);
  return Response.json({ ...DEFAULT_GOALS, ...stored });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  const body = await request.json();
  const current = await loadJson<Partial<Goals>>(KEY, FALLBACK, DEFAULT_GOALS);
  const updated = { ...DEFAULT_GOALS, ...current, ...body };
  await saveJson(KEY, FALLBACK, updated);
  return Response.json(updated);
}
