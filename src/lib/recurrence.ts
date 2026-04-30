/**
 * Recurring task scheduler.
 *
 * Stored as JSONB on tasks.recurrence. Two modes:
 *   - "schedule"   — next occurrence anchored on the task's endDate
 *                    (so completing late doesn't shift future instances)
 *   - "completion" — next occurrence anchored on when you actually completed
 *                    the task
 */

export type RecurrenceMode = "schedule" | "completion";

export type DailyPattern = {
  type: "daily";
  everyN: number;
};

export type WeeklyPattern = {
  type: "weekly";
  everyN: number;
  /** 0=Sun, 1=Mon, ..., 6=Sat */
  daysOfWeek: number[];
};

export type MonthlyDayPattern = {
  type: "monthly_day";
  everyN: number;
  /** 1..31 */
  dayOfMonth: number;
};

export type MonthlyNthWeekdayPattern = {
  type: "monthly_nth_weekday";
  everyN: number;
  /** 1..4, or -1 for "last" */
  nth: number;
  /** 0=Sun..6=Sat */
  weekday: number;
};

export type RecurrencePattern =
  | DailyPattern
  | WeeklyPattern
  | MonthlyDayPattern
  | MonthlyNthWeekdayPattern;

export interface RecurrenceRule {
  pattern: RecurrencePattern;
  mode: RecurrenceMode;
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* ── date helpers ──────────────────────────────────────────── */

/** Parse YYYY-MM-DD as a local-midnight Date. */
export function parseISODate(iso: string): Date | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Format Date as YYYY-MM-DD (local). */
export function formatISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function nthWeekdayOfMonth(date: Date): number {
  // 1..5 for the Nth occurrence of date's weekday in its month
  return Math.floor((date.getDate() - 1) / 7) + 1;
}

function isLastWeekdayOfMonth(date: Date): boolean {
  const next = addDays(date, 7);
  return next.getMonth() !== date.getMonth();
}

/* ── pattern matching ──────────────────────────────────────── */

function matchesDaily(date: Date, anchor: Date, p: DailyPattern): boolean {
  const ms = startOfDay(date).getTime() - startOfDay(anchor).getTime();
  const days = Math.round(ms / (24 * 3600 * 1000));
  return days > 0 && days % Math.max(1, p.everyN) === 0;
}

function matchesWeekly(date: Date, anchor: Date, p: WeeklyPattern): boolean {
  if (!p.daysOfWeek.includes(date.getDay())) return false;
  const everyN = Math.max(1, p.everyN);
  // Compare ISO week index (anchored to a fixed Monday) to test the every-N-weeks bucket.
  const anchorMon = mondayOf(anchor);
  const dateMon = mondayOf(date);
  const weeks = Math.round(
    (dateMon.getTime() - anchorMon.getTime()) / (7 * 24 * 3600 * 1000),
  );
  return weeks >= 0 && weeks % everyN === 0;
}

function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(d, diff));
}

function matchesMonthlyDay(date: Date, anchor: Date, p: MonthlyDayPattern): boolean {
  if (date.getDate() !== p.dayOfMonth) return false;
  const months =
    (date.getFullYear() - anchor.getFullYear()) * 12 +
    (date.getMonth() - anchor.getMonth());
  return months >= 0 && months % Math.max(1, p.everyN) === 0;
}

function matchesMonthlyNthWeekday(date: Date, anchor: Date, p: MonthlyNthWeekdayPattern): boolean {
  if (date.getDay() !== p.weekday) return false;
  if (p.nth === -1) {
    if (!isLastWeekdayOfMonth(date)) return false;
  } else {
    if (nthWeekdayOfMonth(date) !== p.nth) return false;
  }
  const months =
    (date.getFullYear() - anchor.getFullYear()) * 12 +
    (date.getMonth() - anchor.getMonth());
  return months >= 0 && months % Math.max(1, p.everyN) === 0;
}

function matchesPattern(date: Date, anchor: Date, p: RecurrencePattern): boolean {
  switch (p.type) {
    case "daily": return matchesDaily(date, anchor, p);
    case "weekly": return matchesWeekly(date, anchor, p);
    case "monthly_day": return matchesMonthlyDay(date, anchor, p);
    case "monthly_nth_weekday": return matchesMonthlyNthWeekday(date, anchor, p);
  }
}

/* ── public API ────────────────────────────────────────────── */

/** Find the next occurrence date strictly after `anchor` (local-midnight Date).
 *
 *  In completion mode for single-day weekly patterns, we skip past the rest of
 *  the current week so "complete a weekly Wednesday task on Tuesday" advances
 *  to *next* Wednesday, not tomorrow. Multi-day weekly is left alone so the
 *  Tue↔Fri rotation keeps working naturally. */
export function nextOccurrence(rule: RecurrenceRule, anchor: Date): Date | null {
  const start = startOfDay(anchor);

  // Special case: weekly with no specific day = "every N weeks, any day".
  // Both modes just shift by 7*N days from the anchor — keeps the same weekday
  // as the anchor, no matching needed.
  if (rule.pattern.type === "weekly" && rule.pattern.daysOfWeek.length === 0) {
    return addDays(start, 7 * Math.max(1, rule.pattern.everyN));
  }

  let iterStart = 1;
  if (
    rule.mode === "completion" &&
    rule.pattern.type === "weekly" &&
    rule.pattern.daysOfWeek.length === 1
  ) {
    // Skip to next Monday so matches land in the next cycle. (Days are
    // numbered Sun=0..Sat=6; with Mon-anchored weeks, "next Monday" means we
    // need a positive offset — never 0 — so completing on a Monday still
    // skips a full week.)
    const dow = start.getDay();
    const daysUntilNextMonday = ((8 - dow) % 7) || 7;
    iterStart = daysUntilNextMonday;
  }

  const MAX_LOOKAHEAD_DAYS = 366 * 5;
  for (let i = iterStart; i <= MAX_LOOKAHEAD_DAYS; i++) {
    const d = addDays(start, i);
    if (matchesPattern(d, start, rule.pattern)) return d;
  }
  return null;
}

/** Human-readable summary, e.g. "Every Tuesday & Friday". */
export function formatRecurrence(rule: RecurrenceRule): string {
  const p = rule.pattern;
  const mode = rule.mode === "completion" ? " (from completion)" : "";
  switch (p.type) {
    case "daily":
      return p.everyN === 1 ? `Every day${mode}` : `Every ${p.everyN} days${mode}`;
    case "weekly": {
      if (p.daysOfWeek.length === 0) {
        return p.everyN === 1
          ? `Every week (any day)${mode}`
          : `Every ${p.everyN} weeks (any day)${mode}`;
      }
      const days = p.daysOfWeek
        .slice()
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
        .map((d) => WEEKDAY_NAMES[d])
        .join(" & ");
      const prefix = p.everyN === 1 ? "Every week on" : `Every ${p.everyN} weeks on`;
      return `${prefix} ${days}${mode}`;
    }
    case "monthly_day":
      return p.everyN === 1
        ? `Every month on day ${p.dayOfMonth}${mode}`
        : `Every ${p.everyN} months on day ${p.dayOfMonth}${mode}`;
    case "monthly_nth_weekday": {
      const nthLabel = p.nth === -1 ? "last" : ordinal(p.nth);
      const day = WEEKDAY_NAMES_FULL[p.weekday];
      return p.everyN === 1
        ? `Every month on the ${nthLabel} ${day}${mode}`
        : `Every ${p.everyN} months on the ${nthLabel} ${day}${mode}`;
    }
  }
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Validate a partial config object came from the client. Returns null if invalid. */
export function validateRecurrenceRule(input: unknown): RecurrenceRule | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (o.mode !== "schedule" && o.mode !== "completion") return null;
  const p = o.pattern as Record<string, unknown> | undefined;
  if (!p || typeof p.type !== "string") return null;
  const everyN = Math.max(1, Number(p.everyN ?? 1) || 1);

  if (p.type === "daily") {
    return { mode: o.mode, pattern: { type: "daily", everyN } };
  }
  if (p.type === "weekly") {
    const days = Array.isArray(p.daysOfWeek)
      ? (p.daysOfWeek as unknown[])
          .map(Number)
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      : [];
    // Empty array means "any day in the week" — repeat shifts by N weeks from anchor.
    return { mode: o.mode, pattern: { type: "weekly", everyN, daysOfWeek: Array.from(new Set(days)).sort() } };
  }
  if (p.type === "monthly_day") {
    const dayOfMonth = Math.min(31, Math.max(1, Number(p.dayOfMonth) || 1));
    return { mode: o.mode, pattern: { type: "monthly_day", everyN, dayOfMonth } };
  }
  if (p.type === "monthly_nth_weekday") {
    const nthRaw = Number(p.nth);
    const nth = nthRaw === -1 ? -1 : Math.min(4, Math.max(1, nthRaw || 1));
    const weekday = Math.min(6, Math.max(0, Number(p.weekday) || 0));
    return { mode: o.mode, pattern: { type: "monthly_nth_weekday", everyN, nth, weekday } };
  }
  return null;
}
