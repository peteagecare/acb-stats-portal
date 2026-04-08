import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";

const KEY = "goals.json";
const FALLBACK = "./goals.json";

const DEFAULT_GOALS = {
  leadGoalPerMonth: null as number | null,
  prospectsGoalPerMonth: null as number | null,
  visitsGoalPerMonth: null as number | null,
  contactsGoalPerMonth: null as number | null,
  siteVisitsGoalPerWeek: null as number | null,
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
  const body = await request.json();
  const current = await loadJson<Partial<Goals>>(KEY, FALLBACK, DEFAULT_GOALS);
  const updated = { ...DEFAULT_GOALS, ...current, ...body };
  await saveJson(KEY, FALLBACK, updated);
  return Response.json(updated);
}
