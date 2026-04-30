/**
 * Pure functions for the workspace "are we on track?" tracker.
 *
 * Status definitions:
 *   - done       — task is completed (no warning even if it ran late)
 *   - overdue    — past endDate and not done
 *   - behind     — actualProgress < expectedProgress − 10%
 *   - ahead      — actualProgress > expectedProgress + 10%
 *   - on_track   — within ±10%
 *   - unscheduled — no startDate or no endDate (not tracked)
 *   - upcoming   — current date is before startDate
 */

export type TrackerStatus =
  | "done"
  | "overdue"
  | "behind"
  | "ahead"
  | "on_track"
  | "unscheduled"
  | "upcoming";

export interface TrackerInput {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  completed: boolean;
  status?: "todo" | "doing" | "blocked" | "done";
  /** 0–1 — overrides status-based progress when provided (e.g. subtask ratio) */
  progressOverride?: number | null;
}

export interface TrackerResult {
  status: TrackerStatus;
  expected: number; // 0..1
  actual: number;   // 0..1
  /** actual − expected; positive = ahead, negative = behind */
  delta: number;
  /** Human-readable label */
  label: string;
}

const ON_TRACK_TOLERANCE = 0.1;

function startOfDayUTC(d: Date) {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDate(d: string | null | undefined): number | null {
  if (!d) return null;
  // Date strings come from Postgres `date` type, e.g. "2026-04-30"
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return null;
  return Date.UTC(y, m - 1, day);
}

function statusToProgress(status?: TrackerInput["status"]): number {
  switch (status) {
    case "done":
      return 1;
    case "doing":
      return 0.5;
    case "todo":
    case "blocked":
    default:
      return 0;
  }
}

export function computeTracker(input: TrackerInput, now: Date = new Date()): TrackerResult {
  if (input.completed) {
    return { status: "done", expected: 1, actual: 1, delta: 0, label: "Done" };
  }

  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  const today = startOfDayUTC(now);

  if (start == null || end == null || end < start) {
    const actual = input.progressOverride ?? statusToProgress(input.status);
    return { status: "unscheduled", expected: 0, actual, delta: 0, label: "No schedule" };
  }

  // Past end date, not done → overdue (takes priority)
  if (today > end) {
    const actual = input.progressOverride ?? statusToProgress(input.status);
    return {
      status: "overdue",
      expected: 1,
      actual,
      delta: actual - 1,
      label: "Overdue",
    };
  }

  // Before start date
  if (today < start) {
    return { status: "upcoming", expected: 0, actual: 0, delta: 0, label: "Upcoming" };
  }

  const totalMs = end - start;
  const elapsedMs = today - start;
  const expected = totalMs === 0 ? 1 : Math.min(1, Math.max(0, elapsedMs / totalMs));
  const actual = Math.max(0, Math.min(1, input.progressOverride ?? statusToProgress(input.status)));
  const delta = actual - expected;

  let status: TrackerStatus;
  let label: string;
  if (delta > ON_TRACK_TOLERANCE) {
    status = "ahead";
    label = "Ahead";
  } else if (delta < -ON_TRACK_TOLERANCE) {
    status = "behind";
    label = "Behind";
  } else {
    status = "on_track";
    label = "On track";
  }
  return { status, expected, actual, delta, label };
}

export const TRACKER_STYLE: Record<TrackerStatus, { color: string; bg: string; dot: string }> = {
  done:        { color: "#065F46", bg: "#D1FAE5", dot: "#10B981" },
  on_track:    { color: "#065F46", bg: "#D1FAE5", dot: "#10B981" },
  ahead:       { color: "#1E40AF", bg: "#DBEAFE", dot: "#3B82F6" },
  behind:      { color: "#92400E", bg: "#FEF3C7", dot: "#F59E0B" },
  overdue:     { color: "#991B1B", bg: "#FEE2E2", dot: "#DC2626" },
  upcoming:    { color: "#475569", bg: "#F1F5F9", dot: "#94A3B8" },
  unscheduled: { color: "#64748B", bg: "transparent", dot: "#CBD5E1" },
};

/* ── project-level rollup ─────────────────────────────────── */

export interface RollupCounts {
  done: number;
  on_track: number;
  ahead: number;
  behind: number;
  overdue: number;
  upcoming: number;
  unscheduled: number;
  total: number;
}

export function rollupTaskStatuses(results: TrackerResult[]): RollupCounts {
  const r: RollupCounts = {
    done: 0, on_track: 0, ahead: 0, behind: 0, overdue: 0, upcoming: 0, unscheduled: 0,
    total: results.length,
  };
  for (const t of results) r[t.status]++;
  return r;
}

/** Project-level status: same math as a task, but `actual` = % tasks done */
export function computeProjectTracker(
  tasks: { completed: boolean; parentTaskId?: string | null }[],
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  now: Date = new Date(),
): TrackerResult {
  const top = tasks.filter((t) => !t.parentTaskId);
  const total = top.length;
  const done = top.filter((t) => t.completed).length;
  const ratio = total === 0 ? 0 : done / total;
  const allDone = total > 0 && done === total;
  return computeTracker(
    {
      startDate,
      endDate,
      completed: allDone,
      progressOverride: ratio,
    },
    now,
  );
}
