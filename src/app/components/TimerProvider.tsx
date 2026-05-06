"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "acb.task-timer";

export interface TimerState {
  taskId: string;
  taskTitle: string;
  /** Total seconds the user planned (for the progress display). */
  totalSeconds: number;
  /** Seconds remaining at the moment we last updated. Combined with `runningSince`
   *  to compute the live remaining time without re-storing every tick. */
  storedRemaining: number;
  /** Epoch ms when the timer was last (re)started. Null when paused. */
  runningSince: number | null;
}

interface TimerContextValue {
  active: TimerState | null;
  remainingSeconds: number;
  startTimer: (taskId: string, taskTitle: string, totalSeconds: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  cancelTimer: () => void;
  /** True for one render after the timer hits 0; consumed by the completion modal. */
  finished: TimerState | null;
  acknowledgeFinished: () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

function loadFromStorage(): TimerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TimerState;
    if (typeof parsed.taskId !== "string" || typeof parsed.totalSeconds !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(state: TimerState | null) {
  if (typeof window === "undefined") return;
  try {
    if (state == null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — ignore */
  }
}

function computeRemaining(s: TimerState): number {
  if (s.runningSince == null) return s.storedRemaining;
  const elapsed = Math.floor((Date.now() - s.runningSince) / 1000);
  return Math.max(0, s.storedRemaining - elapsed);
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<TimerState | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [finished, setFinished] = useState<TimerState | null>(null);
  const finishedFiredFor = useRef<string | null>(null);

  // Hydrate from localStorage once mounted (avoids SSR mismatch).
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) {
      setActive(stored);
      setRemainingSeconds(computeRemaining(stored));
    }
  }, []);

  // Tick every second when there's an active timer running.
  useEffect(() => {
    if (!active) return;
    if (active.runningSince == null) return; // paused — no tick needed
    const id = setInterval(() => {
      const r = computeRemaining(active);
      setRemainingSeconds(r);
      if (r === 0 && finishedFiredFor.current !== active.taskId) {
        finishedFiredFor.current = active.taskId;
        setFinished(active);
      }
    }, 500);
    return () => clearInterval(id);
  }, [active]);

  // Persist any time `active` changes
  useEffect(() => { saveToStorage(active); }, [active]);

  // Cross-tab sync: another tab updating localStorage updates us too.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      const next = loadFromStorage();
      setActive(next);
      setRemainingSeconds(next ? computeRemaining(next) : 0);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const startTimer = useCallback((taskId: string, taskTitle: string, totalSeconds: number) => {
    finishedFiredFor.current = null;
    const next: TimerState = {
      taskId, taskTitle, totalSeconds,
      storedRemaining: totalSeconds,
      runningSince: Date.now(),
    };
    setActive(next);
    setRemainingSeconds(totalSeconds);
    setFinished(null);
  }, []);

  const pauseTimer = useCallback(() => {
    setActive((prev) => {
      if (!prev || prev.runningSince == null) return prev;
      return { ...prev, storedRemaining: computeRemaining(prev), runningSince: null };
    });
  }, []);

  const resumeTimer = useCallback(() => {
    setActive((prev) => {
      if (!prev || prev.runningSince != null) return prev;
      if (prev.storedRemaining <= 0) return prev;
      return { ...prev, runningSince: Date.now() };
    });
  }, []);

  const cancelTimer = useCallback(() => {
    finishedFiredFor.current = null;
    setActive(null);
    setRemainingSeconds(0);
    setFinished(null);
  }, []);

  const acknowledgeFinished = useCallback(() => {
    setFinished(null);
    setActive(null);
    setRemainingSeconds(0);
  }, []);

  const value = useMemo<TimerContextValue>(() => ({
    active,
    remainingSeconds,
    startTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer,
    finished,
    acknowledgeFinished,
  }), [active, remainingSeconds, startTimer, pauseTimer, resumeTimer, cancelTimer, finished, acknowledgeFinished]);

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer(): TimerContextValue {
  const v = useContext(TimerContext);
  if (!v) throw new Error("useTimer must be inside <TimerProvider>");
  return v;
}

export function formatTimerClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
