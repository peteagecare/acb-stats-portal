import { NextRequest } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const GOALS_PATH = path.join(process.cwd(), "goals.json");

const DEFAULT_GOALS = {
  leadGoalPerMonth: null as number | null,
  prospectsGoalPerMonth: null as number | null,
  visitsGoalPerMonth: null as number | null,
  ppcPercentGoal: null as number | null,
  seoPercentGoal: null as number | null,
  contentPercentGoal: null as number | null,
  otherPercentGoal: null as number | null,
};

async function loadGoals() {
  try {
    const data = await readFile(GOALS_PATH, "utf8");
    return { ...DEFAULT_GOALS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_GOALS;
  }
}

export async function GET() {
  return Response.json(await loadGoals());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const current = await loadGoals();
  const updated = { ...current, ...body };

  try {
    await writeFile(GOALS_PATH, JSON.stringify(updated, null, 2) + "\n");
  } catch {
    // On Vercel the filesystem is read-only — goals are set by committing goals.json
  }

  return Response.json(updated);
}
