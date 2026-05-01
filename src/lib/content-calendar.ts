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
  "LinkedIn - Business",
  "LinkedIn - Sam",
  "YouTube Video",
  "Stories / Reels - Facebook, Instagram, TikTok & YouTube Shorts",
  "Past Projects",
  "Blog",
  "Newsletter",
  "Facebook & Instagram",
  "Facebook, Linked In, TikTok & Instagram",
  "Instagram Live",
  "Facebook, Instagram & TikTok",
  "TikTok",
  "Knowledge Base",
] as const;
export type CalendarPlatform = (typeof CALENDAR_PLATFORMS)[number];

export const CALENDAR_ASSET_TYPES = [
  "IMAGE",
  "VIDEO",
  "TEXT",
  "OTHER",
  "IMAGE WITH TEXT CAPTION",
  "EMAIL",
  "IMAGE CAROUSEL",
] as const;
export type CalendarAssetType = (typeof CALENDAR_ASSET_TYPES)[number];

export interface CalendarEntry {
  id: string;
  liveDate: string;
  time?: string;
  platform: CalendarPlatform;
  assetType?: CalendarAssetType;
  status: CalendarStatus;
  title: string;
  notes?: string;
  responsible?: string;
  assetLink?: string;
  supportedLinks?: string[];
  feedback?: string;
  needsFinanceApproval: boolean;
  submittedBy: string;
  submittedByLabel: string;
  submittedAt: string;
  updatedBy?: string;
  updatedByLabel?: string;
  updatedAt?: string;
}

export const STATUS_COLOURS: Record<CalendarStatus, { bg: string; fg: string }> = {
  "Not Started": { bg: "#e5e7eb", fg: "#374151" },
  "In Progress": { bg: "#dbeafe", fg: "#1e40af" },
  "To Check - Pete": { bg: "#fef3c7", fg: "#92400e" },
  "Suggested Changes": { bg: "#fde68a", fg: "#78350f" },
  "Approved": { bg: "#d1fae5", fg: "#065f46" },
  "Scheduled": { bg: "#e0e7ff", fg: "#3730a3" },
  "Live": { bg: "#7c3aed", fg: "#ffffff" },
  "Cancelled": { bg: "#374151", fg: "#ffffff" },
  "Scheduled - Post On The Day": { bg: "#cffafe", fg: "#155e75" },
  "Feedback": { bg: "#fce7f3", fg: "#9d174d" },
  "Prep": { bg: "#f3e8ff", fg: "#6b21a8" },
  "Awaiting Finance Approval": { bg: "#fee2e2", fg: "#991b1b" },
};

export const ASSET_TYPE_COLOURS: Record<CalendarAssetType, { bg: string; fg: string }> = {
  IMAGE: { bg: "#fef3c7", fg: "#78350f" },
  VIDEO: { bg: "#fecaca", fg: "#7f1d1d" },
  TEXT: { bg: "#fed7aa", fg: "#7c2d12" },
  OTHER: { bg: "#fef9c3", fg: "#713f12" },
  "IMAGE WITH TEXT CAPTION": { bg: "#bfdbfe", fg: "#1e3a8a" },
  EMAIL: { bg: "#e5e7eb", fg: "#374151" },
  "IMAGE CAROUSEL": { bg: "#c7d2fe", fg: "#3730a3" },
};

export function isStatus(v: unknown): v is CalendarStatus {
  return typeof v === "string" && (CALENDAR_STATUSES as readonly string[]).includes(v);
}
export function isPlatform(v: unknown): v is CalendarPlatform {
  return typeof v === "string" && (CALENDAR_PLATFORMS as readonly string[]).includes(v);
}
export function isAssetType(v: unknown): v is CalendarAssetType {
  return typeof v === "string" && (CALENDAR_ASSET_TYPES as readonly string[]).includes(v);
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
