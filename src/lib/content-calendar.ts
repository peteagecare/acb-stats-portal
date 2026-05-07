export const CALENDAR_STATUSES = [
  "Not Started",
  "In Progress",
  "To Check - Pete",
  "Suggested Changes",
  "Approved",
  "Scheduled",
  "Live",
  "Cancelled",
  "Scheduled - Post On The Day",
  "Feedback",
  "Prep",
  "Awaiting Finance Approval",
] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export const CALENDAR_PLATFORMS = [
  "Facebook",
  "Instagram",
  "LinkedIn - Business",
  "LinkedIn - Sam",
  "YouTube",
  "TikTok",
  "Email",
  "Blog",
  "Past Projects",
  "Knowledge Base",
] as const;
export type CalendarPlatform = (typeof CALENDAR_PLATFORMS)[number];

/**
 * Format/medium of a content piece. A single piece can span multiple types
 * (e.g. a Reel that's also re-posted as a Story). Types replace the old
 * single-value asset type field.
 */
export const CALENDAR_TYPES = [
  "Reel",
  "Story",
  "Image",
  "Video",
  "Image Carousel",
  "Text",
] as const;
export type CalendarType = (typeof CALENDAR_TYPES)[number];

export interface CalendarEntry {
  id: string;
  liveDate: string;
  time?: string;
  platforms: CalendarPlatform[];
  types: CalendarType[];
  status: CalendarStatus;
  title: string;
  notes?: string;
  responsible?: string;
  assetLink?: string;
  supportedLinks?: string[];
  feedback?: string;
  needsFinanceApproval: boolean;
  /** Rich-text HTML body for the long-form planning notes on this content piece. */
  content?: string;
  submittedBy: string;
  submittedByLabel: string;
  submittedAt: string;
  updatedBy?: string;
  updatedByLabel?: string;
  updatedAt?: string;
}

export const STATUS_COLOURS: Record<CalendarStatus, { bg: string; fg: string; row: string }> = {
  "Not Started": { bg: "#e5e7eb", fg: "#374151", row: "#f9fafb" },
  "In Progress": { bg: "#dbeafe", fg: "#1e40af", row: "#eff6ff" },
  "To Check - Pete": { bg: "#fef3c7", fg: "#92400e", row: "#fffbeb" },
  "Suggested Changes": { bg: "#fde68a", fg: "#78350f", row: "#fef3c7" },
  "Approved": { bg: "#d1fae5", fg: "#065f46", row: "#ecfdf5" },
  "Scheduled": { bg: "#e0e7ff", fg: "#3730a3", row: "#eef2ff" },
  "Live": { bg: "#7c3aed", fg: "#ffffff", row: "#ede9fe" },
  "Cancelled": { bg: "#374151", fg: "#ffffff", row: "#f3f4f6" },
  "Scheduled - Post On The Day": { bg: "#cffafe", fg: "#155e75", row: "#ecfeff" },
  "Feedback": { bg: "#fce7f3", fg: "#9d174d", row: "#fdf2f8" },
  "Prep": { bg: "#f3e8ff", fg: "#6b21a8", row: "#faf5ff" },
  "Awaiting Finance Approval": { bg: "#fee2e2", fg: "#991b1b", row: "#fef2f2" },
};

export const PLATFORM_COLOURS: Record<CalendarPlatform, { bg: string; fg: string }> = {
  Facebook: { bg: "#dbeafe", fg: "#1d4ed8" },
  Instagram: { bg: "#fce7f3", fg: "#9d174d" },
  "LinkedIn - Business": { bg: "#e0e7ff", fg: "#1e3a8a" },
  "LinkedIn - Sam": { bg: "#ede9fe", fg: "#5b21b6" },
  YouTube: { bg: "#fee2e2", fg: "#991b1b" },
  TikTok: { bg: "#1f2937", fg: "#f9fafb" },
  Email: { bg: "#cffafe", fg: "#155e75" },
  Blog: { bg: "#fed7aa", fg: "#7c2d12" },
  "Past Projects": { bg: "#f3e8ff", fg: "#6b21a8" },
  "Knowledge Base": { bg: "#fef3c7", fg: "#78350f" },
};

export const TYPE_COLOURS: Record<CalendarType, { bg: string; fg: string }> = {
  Reel: { bg: "#fecaca", fg: "#7f1d1d" },
  Story: { bg: "#fbcfe8", fg: "#831843" },
  Image: { bg: "#fef3c7", fg: "#78350f" },
  Video: { bg: "#fecaca", fg: "#991b1b" },
  "Image Carousel": { bg: "#c7d2fe", fg: "#3730a3" },
  Text: { bg: "#fed7aa", fg: "#7c2d12" },
};

export function isStatus(v: unknown): v is CalendarStatus {
  return typeof v === "string" && (CALENDAR_STATUSES as readonly string[]).includes(v);
}
export function isPlatform(v: unknown): v is CalendarPlatform {
  return typeof v === "string" && (CALENDAR_PLATFORMS as readonly string[]).includes(v);
}
export function arePlatforms(v: unknown): v is CalendarPlatform[] {
  return Array.isArray(v) && v.length > 0 && v.every(isPlatform);
}
export function isType(v: unknown): v is CalendarType {
  return typeof v === "string" && (CALENDAR_TYPES as readonly string[]).includes(v);
}
export function areTypes(v: unknown): v is CalendarType[] {
  return Array.isArray(v) && v.every(isType);
}

/**
 * Map any historical platform string (single or composite) to today's
 * `{platforms, types}` pair. Covers two prior generations:
 *
 *   1. The original composite labels (e.g. "Stories / Reels - …",
 *      "Facebook & Instagram", "Newsletter", etc.).
 *   2. The previous 14-platform fan-out which split format into the
 *      platform name itself (e.g. "Facebook Reel", "Facebook Post").
 */
const PLATFORM_LEGACY_MAP: Record<string, { platforms: CalendarPlatform[]; types: CalendarType[] }> = {
  // Original composite labels
  "Stories / Reels - Facebook, Instagram, TikTok & YouTube Shorts": {
    platforms: ["Facebook", "Instagram", "TikTok", "YouTube"],
    types: ["Reel", "Story"],
  },
  Newsletter: { platforms: ["Email"], types: [] },
  "Facebook & Instagram": { platforms: ["Facebook", "Instagram"], types: [] },
  "Facebook, Linked In, TikTok & Instagram": {
    platforms: ["Facebook", "LinkedIn - Business", "TikTok", "Instagram"],
    types: [],
  },
  "Facebook, Instagram & TikTok": {
    platforms: ["Facebook", "Instagram", "TikTok"],
    types: [],
  },
  "Instagram Live": { platforms: ["Instagram"], types: [] },

  // Previous 14-platform fan-out
  "Facebook Reel": { platforms: ["Facebook"], types: ["Reel"] },
  "Facebook Story": { platforms: ["Facebook"], types: ["Story"] },
  "Facebook Post": { platforms: ["Facebook"], types: [] },
  "Instagram Story": { platforms: ["Instagram"], types: ["Story"] },
  "Instagram Post": { platforms: ["Instagram"], types: [] },
  "YouTube Video": { platforms: ["YouTube"], types: ["Video"] },
  "YouTube Shorts": { platforms: ["YouTube"], types: ["Reel"] },
};

const ASSET_TYPE_LEGACY_MAP: Record<string, CalendarType[]> = {
  IMAGE: ["Image"],
  VIDEO: ["Video"],
  TEXT: ["Text"],
  OTHER: [],
  "IMAGE WITH TEXT CAPTION": ["Image"],
  EMAIL: [],
  "IMAGE CAROUSEL": ["Image Carousel"],
};

function dedupeOrdered<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

/** Resolve a single legacy or current platform string to the new model. */
function resolvePlatformString(value: string): { platforms: CalendarPlatform[]; types: CalendarType[] } {
  if (isPlatform(value)) return { platforms: [value], types: [] };
  return PLATFORM_LEGACY_MAP[value] ?? { platforms: [], types: [] };
}

/**
 * Normalise a raw entry from blob storage to the current shape. Handles every
 * historical schema by collecting platforms + types from `platform`,
 * `platforms`, and `assetType`/`types`. Returns `null` if no platform can be
 * resolved — the entry will be hidden on read but not deleted from storage.
 */
export function migrateRawEntry(raw: unknown): CalendarEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const platforms: CalendarPlatform[] = [];
  const types: CalendarType[] = [];

  // Pull from any platform field — single string, array of strings, or
  // already-current array of CalendarPlatform values.
  const platformSources: unknown[] = [];
  if (Array.isArray(r.platforms)) platformSources.push(...r.platforms);
  if (typeof r.platform === "string") platformSources.push(r.platform);
  for (const src of platformSources) {
    if (typeof src !== "string") continue;
    const { platforms: ps, types: ts } = resolvePlatformString(src);
    platforms.push(...ps);
    types.push(...ts);
  }

  // Current `types` array (ignore unknowns).
  if (Array.isArray(r.types)) {
    for (const t of r.types) if (isType(t)) types.push(t);
  }

  // Legacy `assetType` single value.
  if (typeof r.assetType === "string") {
    const mapped = ASSET_TYPE_LEGACY_MAP[r.assetType] ?? [];
    types.push(...mapped);
  }

  if (platforms.length === 0) return null;
  const cleanPlatforms = dedupeOrdered(platforms);
  const cleanTypes = dedupeOrdered(types);

  const { platform: _p, assetType: _a, types: _t, platforms: _ps, ...rest } = r;
  void _p; void _a; void _t; void _ps;

  return {
    ...(rest as object),
    platforms: cleanPlatforms,
    types: cleanTypes,
  } as CalendarEntry;
}

/** Convert a raw value (string | array | undefined) to platforms + types. */
export function migratePlatformValue(legacy: unknown): { platforms: CalendarPlatform[]; types: CalendarType[] } {
  const platforms: CalendarPlatform[] = [];
  const types: CalendarType[] = [];
  const sources: unknown[] = Array.isArray(legacy) ? legacy : [legacy];
  for (const src of sources) {
    if (typeof src !== "string") continue;
    const { platforms: ps, types: ts } = resolvePlatformString(src);
    platforms.push(...ps);
    types.push(...ts);
  }
  return { platforms: dedupeOrdered(platforms), types: dedupeOrdered(types) };
}

export function shortPlatformLabel(p: CalendarPlatform): string {
  switch (p) {
    case "LinkedIn - Business":
      return "LinkedIn — Business";
    case "LinkedIn - Sam":
      return "LinkedIn — Sam";
    default:
      return p;
  }
}

export function isValidUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());
}

export function isValidTime(v: string): boolean {
  return /^\d{2}:\d{2}$/.test(v);
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function fmtIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekKey(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return fmtIsoDate(startOfWeek(d));
}

export function weekLabel(isoMonday: string): string {
  const start = new Date(isoMonday + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const monthStart = start.toLocaleString("en-GB", { month: "short" });
  const monthEnd = end.toLocaleString("en-GB", { month: "short" });
  if (monthStart === monthEnd) {
    return `${monthStart} ${start.getDate()}–${end.getDate()}`;
  }
  return `${monthStart} ${start.getDate()} – ${monthEnd} ${end.getDate()}`;
}
