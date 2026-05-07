import { NextRequest } from "next/server";
import { loadJson, saveJson } from "@/lib/blob-store";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import {
  CalendarPlatform,
  CalendarType,
  arePlatforms,
  areTypes,
  isType,
  migratePlatformValue,
} from "@/lib/content-calendar";

const KEY = "posting-schedule.json";
const FALLBACK = "./posting-schedule.json";

export interface ScheduleSlot {
  id: string;
  /** 0=Sun, 1=Mon, …, 6=Sat */
  weekday: number;
  /** HH:MM 24-hour, optional */
  time?: string;
  platforms: CalendarPlatform[];
  types: CalendarType[];
  /** Short display label for the modal/calendar (e.g. "Story / Reel"). */
  label: string;
}

interface ScheduleFile {
  slots: ScheduleSlot[];
  /** Weekday numbers (0=Sun..6=Sat) that are disabled — ghost slots won't render. */
  disabledDays?: number[];
}

const STORY_REEL_PLATFORMS: CalendarPlatform[] = ["Facebook", "Instagram", "TikTok", "YouTube"];
const STORY_REEL_TYPES: CalendarType[] = ["Reel", "Story"];
const FB_IG: CalendarPlatform[] = ["Facebook", "Instagram"];

function defaultSlots(): ScheduleSlot[] {
  return [
    // Monday
    { id: crypto.randomUUID(), weekday: 1, platforms: STORY_REEL_PLATFORMS, types: STORY_REEL_TYPES, label: "Story / Reel — FB, IG, TikTok" },
    { id: crypto.randomUUID(), weekday: 1, platforms: FB_IG, types: ["Image"], label: "FB & IG Post" },
    // Tuesday
    { id: crypto.randomUUID(), weekday: 2, platforms: ["LinkedIn - Business"], types: ["Text"], label: "LinkedIn — Business" },
    // Wednesday
    { id: crypto.randomUUID(), weekday: 3, platforms: ["Email"], types: [], label: "Newsletter" },
    { id: crypto.randomUUID(), weekday: 3, platforms: ["LinkedIn - Sam"], types: ["Text"], label: "LinkedIn — Sam" },
    { id: crypto.randomUUID(), weekday: 3, platforms: STORY_REEL_PLATFORMS, types: STORY_REEL_TYPES, label: "Story / Reel" },
    // Thursday
    { id: crypto.randomUUID(), weekday: 4, platforms: ["Blog"], types: ["Text"], label: "Blog" },
    // Friday
    { id: crypto.randomUUID(), weekday: 5, platforms: STORY_REEL_PLATFORMS, types: STORY_REEL_TYPES, label: "Story / Reel" },
    { id: crypto.randomUUID(), weekday: 5, platforms: FB_IG, types: ["Image"], label: "FB & IG Post" },
    { id: crypto.randomUUID(), weekday: 5, platforms: STORY_REEL_PLATFORMS, types: STORY_REEL_TYPES, label: "Story / Reel" },
  ];
}

function migrateSlot(raw: unknown): ScheduleSlot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.weekday !== "number" || typeof r.label !== "string") return null;

  // Resolve platforms (current array, legacy single, or composite string).
  let platforms: CalendarPlatform[] = [];
  let typesFromPlatform: CalendarType[] = [];
  if (Array.isArray(r.platforms)) {
    if (arePlatforms(r.platforms)) {
      platforms = r.platforms;
    } else {
      const m = migratePlatformValue(r.platforms);
      platforms = m.platforms;
      typesFromPlatform = m.types;
    }
  } else if (typeof r.platform === "string") {
    const m = migratePlatformValue(r.platform);
    platforms = m.platforms;
    typesFromPlatform = m.types;
  }
  if (platforms.length === 0) return null;

  // Resolve types — current array, plus any from legacy assetType / platform.
  const types: CalendarType[] = [];
  if (areTypes(r.types)) types.push(...r.types);
  if (typeof r.assetType === "string") {
    const map: Record<string, CalendarType[]> = {
      IMAGE: ["Image"],
      VIDEO: ["Video"],
      TEXT: ["Text"],
      OTHER: [],
      "IMAGE WITH TEXT CAPTION": ["Image"],
      EMAIL: [],
      "IMAGE CAROUSEL": ["Image Carousel"],
    };
    types.push(...(map[r.assetType] ?? []));
  }
  types.push(...typesFromPlatform);
  const dedupedTypes = Array.from(new Set(types)).filter(isType);

  return {
    id: typeof r.id === "string" ? r.id : crypto.randomUUID(),
    weekday: Math.max(0, Math.min(6, Math.floor(r.weekday))),
    time: typeof r.time === "string" && /^\d{1,2}:\d{2}$/.test(r.time) ? r.time : undefined,
    platforms,
    types: dedupedTypes,
    label: r.label,
  };
}

async function load(): Promise<ScheduleFile> {
  const stored = await loadJson<ScheduleFile>(KEY, FALLBACK, { slots: [] });
  const rawSlots = Array.isArray((stored as unknown as { slots?: unknown }).slots)
    ? (stored as unknown as { slots: unknown[] }).slots
    : [];
  if (rawSlots.length === 0) {
    const seeded: ScheduleFile = { slots: defaultSlots() };
    await saveJson(KEY, FALLBACK, seeded);
    return seeded;
  }
  const slots = rawSlots
    .map(migrateSlot)
    .filter((s): s is ScheduleSlot => s !== null);
  return { slots, disabledDays: stored.disabledDays };
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
  const body = (await request.json()) as { slots?: unknown; disabledDays?: number[] };
  if (!Array.isArray(body.slots)) {
    return Response.json({ error: "slots[] required" }, { status: 400 });
  }
  const cleaned: ScheduleSlot[] = body.slots
    .map((raw) => migrateSlot(raw))
    .filter((s): s is ScheduleSlot => s !== null);
  const disabledDays = Array.isArray(body.disabledDays)
    ? Array.from(new Set(body.disabledDays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)))
    : [];
  const next: ScheduleFile = { slots: cleaned, disabledDays };
  await save(next);
  return Response.json(next);
}
