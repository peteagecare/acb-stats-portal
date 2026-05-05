import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { CalendarPlatform, CalendarAssetType } from "@/lib/content-calendar";

const KEY = "posting-schedule.json";
const FALLBACK = "./posting-schedule.json";

export interface ScheduleSlot {
  id: string;
  /** 0=Sun, 1=Mon, …, 6=Sat */
  weekday: number;
  /** HH:MM 24-hour, optional */
  time?: string;
  platform: CalendarPlatform;
  assetType?: CalendarAssetType;
  /** Short display label for the modal/calendar (e.g. "Story / Reel"). */
  label: string;
}

interface ScheduleFile {
  slots: ScheduleSlot[];
  /** Weekday numbers (0=Sun..6=Sat) that are disabled — ghost slots won't render. */
  disabledDays?: number[];
}

const STORY_REEL: CalendarPlatform = "Stories / Reels - Facebook, Instagram, TikTok & YouTube Shorts";
const FB_IG: CalendarPlatform = "Facebook & Instagram";
const LI_BUS: CalendarPlatform = "LinkedIn - Business";
const LI_SAM: CalendarPlatform = "LinkedIn - Sam";
const NEWS: CalendarPlatform = "Newsletter";
const BLOG: CalendarPlatform = "Blog";

function defaultSlots(): ScheduleSlot[] {
  // Pete's recurring weekly skeleton (May 2026).
  // Slots are intentionally ordered within each day to match how Pete listed them.
  return [
    // Monday
    { id: crypto.randomUUID(), weekday: 1, platform: STORY_REEL, assetType: "VIDEO", label: "Story / Reel — FB, IG, TikTok" },
    { id: crypto.randomUUID(), weekday: 1, platform: FB_IG,      assetType: "IMAGE", label: "FB & IG Post" },
    // Tuesday
    { id: crypto.randomUUID(), weekday: 2, platform: LI_BUS,     assetType: "TEXT",  label: "LinkedIn — Business" },
    // Wednesday
    { id: crypto.randomUUID(), weekday: 3, platform: NEWS,       assetType: "EMAIL", label: "Newsletter" },
    { id: crypto.randomUUID(), weekday: 3, platform: LI_SAM,     assetType: "TEXT",  label: "LinkedIn — Sam" },
    { id: crypto.randomUUID(), weekday: 3, platform: STORY_REEL, assetType: "VIDEO", label: "Story / Reel" },
    // Thursday
    { id: crypto.randomUUID(), weekday: 4, platform: BLOG,       assetType: "TEXT",  label: "Blog" },
    // Friday
    { id: crypto.randomUUID(), weekday: 5, platform: STORY_REEL, assetType: "VIDEO", label: "Story / Reel" },
    { id: crypto.randomUUID(), weekday: 5, platform: FB_IG,      assetType: "IMAGE", label: "FB & IG Post" },
    { id: crypto.randomUUID(), weekday: 5, platform: STORY_REEL, assetType: "VIDEO", label: "Story / Reel" },
  ];
}

async function load(): Promise<ScheduleFile> {
  const stored = await loadJson<ScheduleFile>(KEY, FALLBACK, { slots: [] });
  if (!stored.slots || stored.slots.length === 0) {
    const seeded: ScheduleFile = { slots: defaultSlots() };
    await saveJson(KEY, FALLBACK, seeded);
    return seeded;
  }
  return stored;
}
async function save(d: ScheduleFile): Promise<void> {
  await saveJson(KEY, FALLBACK, d);
}
function requireAuth(request: NextRequest): { email: string } | null {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  return user ? { email: user.email } : null;
}

export async function GET() {
  const data = await load();
  return Response.json(data);
}

/** Replace the entire slot list (and optionally disabledDays). */
export async function PUT(request: NextRequest) {
  const user = requireAuth(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as { slots?: ScheduleSlot[]; disabledDays?: number[] };
  if (!Array.isArray(body.slots)) {
    return Response.json({ error: "slots[] required" }, { status: 400 });
  }
  const cleaned: ScheduleSlot[] = body.slots
    .filter((s) => s && typeof s.weekday === "number" && s.platform && s.label)
    .map((s) => ({
      id: s.id || crypto.randomUUID(),
      weekday: Math.max(0, Math.min(6, Math.floor(s.weekday))),
      time: s.time?.match(/^\d{1,2}:\d{2}$/) ? s.time : undefined,
      platform: s.platform,
      assetType: s.assetType,
      label: s.label.trim(),
    }));
  const disabledDays = Array.isArray(body.disabledDays)
    ? Array.from(new Set(body.disabledDays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)))
    : [];
  const next: ScheduleFile = { slots: cleaned, disabledDays };
  await save(next);
  return Response.json(next);
}
