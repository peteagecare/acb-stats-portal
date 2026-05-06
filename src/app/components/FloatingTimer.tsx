"use client";

import { useState } from "react";
import { formatTimerClock, useTimer } from "./TimerProvider";

export function FloatingTimer() {
  const { active, remainingSeconds, startTimer, pauseTimer, resumeTimer, cancelTimer, finished, acknowledgeFinished } = useTimer();
  const [completing, setCompleting] = useState(false);
  const [snoozing, setSnoozing] = useState(false);

  if (!active && !finished) return null;

  const showFinished = finished != null;
  const display = showFinished ? finished! : active!;
  const running = !showFinished && active?.runningSince != null;
  const totalSec = display.totalSeconds || 1;
  const pct = Math.max(0, Math.min(100, ((totalSec - remainingSeconds) / totalSec) * 100));
  const isLowTime = !showFinished && remainingSeconds <= 60 && remainingSeconds > 0;

  const accent = showFinished ? "#10B981" : isLowTime ? "#DC2626" : "var(--color-accent)";

  async function markComplete() {
    setCompleting(true);
    try {
      await fetch(`/api/tasks/${display.taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });
      acknowledgeFinished();
      // The dashboard / task view rely on a refetch — easiest is a soft reload of any
      // visible task surface. The timer modal itself is global, so reload here.
      window.location.reload();
    } finally {
      setCompleting(false);
    }
  }

  function snoozeFiveMin() {
    setSnoozing(true);
    // Replace the finished timer with a fresh 5-min one for the same task.
    startTimer(display.taskId, display.taskTitle, 5 * 60);
    setSnoozing(false);
  }

  return (
    <>
      {/* Pill in bottom-right */}
      <div style={{
        position: "fixed", bottom: 20, right: 20, zIndex: 1100,
        background: "white",
        border: `1px solid ${accent}`,
        borderRadius: 14,
        boxShadow: "0 10px 32px rgba(0,0,0,0.18)",
        padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 12,
        minWidth: 280, maxWidth: 360,
        fontFamily: "inherit",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, color: "var(--color-text-tertiary)", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3,
          }}>
            {showFinished ? "Time's up" : running ? "Running" : "Paused"}
          </div>
          <div style={{
            fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            marginBottom: 6,
          }}>
            {display.taskTitle}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums",
              color: accent, lineHeight: 1,
            }}>
              {formatTimerClock(remainingSeconds)}
            </div>
            <div style={{ flex: 1, height: 4, background: "rgba(0,0,0,0.06)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: accent, transition: "width 0.4s linear" }} />
            </div>
          </div>
        </div>
        {!showFinished && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button
              onClick={running ? pauseTimer : resumeTimer}
              aria-label={running ? "Pause timer" : "Resume timer"}
              title={running ? "Pause" : "Resume"}
              style={iconBtnStyle}
            >
              {running ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20" /></svg>
              )}
            </button>
            <button
              onClick={() => { if (confirm("Cancel this timer?")) cancelTimer(); }}
              aria-label="Cancel timer"
              title="Cancel"
              style={iconBtnStyle}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Completion prompt modal */}
      {showFinished && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1200,
          background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }}>
          <div style={{
            background: "white", borderRadius: 18,
            padding: "24px 26px",
            maxWidth: 420, width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            fontFamily: "inherit",
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Time's up!</div>
            <div style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 6 }}>
              Have you completed this task?
            </div>
            <div style={{
              fontSize: 14, fontWeight: 500,
              padding: "10px 12px", background: "rgba(0,0,0,0.04)",
              borderRadius: 10, marginBottom: 16,
              wordBreak: "break-word",
            }}>
              {display.taskTitle}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={markComplete}
                disabled={completing}
                style={{
                  flex: 1, padding: "10px 14px",
                  background: "#10B981", color: "white", border: "none",
                  borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 600,
                  opacity: completing ? 0.6 : 1,
                }}
              >
                {completing ? "Marking…" : "Yes, mark complete"}
              </button>
              <button
                onClick={snoozeFiveMin}
                disabled={snoozing}
                style={{
                  padding: "10px 14px",
                  background: "transparent", border: "1px solid var(--color-border)",
                  borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)",
                }}
              >
                +5 min
              </button>
              <button
                onClick={acknowledgeFinished}
                style={{
                  padding: "10px 14px",
                  background: "transparent", border: "1px solid var(--color-border)",
                  borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)",
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: "transparent", border: "none",
  padding: 6, borderRadius: 8,
  cursor: "pointer", fontFamily: "inherit",
  color: "var(--color-text-secondary)",
  display: "flex", alignItems: "center", justifyContent: "center",
};
