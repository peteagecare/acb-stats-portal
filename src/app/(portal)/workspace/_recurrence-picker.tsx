"use client";

import { useState } from "react";
import {
  RecurrenceMode,
  RecurrencePattern,
  RecurrenceRule,
  formatRecurrence,
} from "@/lib/recurrence";
import { inputStyle } from "./_shared";

type PickerType = "none" | "daily" | "weekly" | "monthly_day" | "monthly_nth";

const DAYS: { value: number; label: string }[] = [
  { value: 1, label: "M" }, { value: 2, label: "T" }, { value: 3, label: "W" },
  { value: 4, label: "T" }, { value: 5, label: "F" }, { value: 6, label: "S" },
  { value: 0, label: "S" },
];

const NTH_OPTIONS = [
  { value: 1, label: "1st" }, { value: 2, label: "2nd" },
  { value: 3, label: "3rd" }, { value: 4, label: "4th" },
  { value: -1, label: "last" },
];

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Monday" }, { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" }, { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" }, { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

function patternToType(p: RecurrencePattern | undefined): PickerType {
  if (!p) return "none";
  if (p.type === "daily") return "daily";
  if (p.type === "weekly") return "weekly";
  if (p.type === "monthly_day") return "monthly_day";
  return "monthly_nth";
}

export function RecurrencePicker({
  value, onChange,
}: {
  value: RecurrenceRule | null;
  onChange: (next: RecurrenceRule | null) => void;
}) {
  const [type, setType] = useState<PickerType>(patternToType(value?.pattern));
  const [everyN, setEveryN] = useState<number>(value?.pattern?.everyN ?? 1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    value?.pattern && value.pattern.type === "weekly" ? value.pattern.daysOfWeek : [],
  );
  const [dayOfMonth, setDayOfMonth] = useState<number>(
    value?.pattern && value.pattern.type === "monthly_day" ? value.pattern.dayOfMonth : new Date().getDate(),
  );
  const [nth, setNth] = useState<number>(
    value?.pattern && value.pattern.type === "monthly_nth_weekday" ? value.pattern.nth : 1,
  );
  const [nthWeekday, setNthWeekday] = useState<number>(
    value?.pattern && value.pattern.type === "monthly_nth_weekday" ? value.pattern.weekday : 1,
  );
  const [mode, setMode] = useState<RecurrenceMode>(value?.mode ?? "schedule");

  function emit(opts: {
    type?: PickerType;
    everyN?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    nth?: number;
    nthWeekday?: number;
    mode?: RecurrenceMode;
  } = {}) {
    const t = opts.type ?? type;
    const n = opts.everyN ?? everyN;
    const m = opts.mode ?? mode;
    if (t === "none") {
      onChange(null);
      return;
    }
    let pattern: RecurrencePattern;
    if (t === "daily") {
      pattern = { type: "daily", everyN: Math.max(1, n) };
    } else if (t === "weekly") {
      const days = opts.daysOfWeek ?? daysOfWeek;
      // Empty list = "any day this week" — schedule shifts by N weeks from anchor.
      pattern = { type: "weekly", everyN: Math.max(1, n), daysOfWeek: days };
    } else if (t === "monthly_day") {
      pattern = { type: "monthly_day", everyN: Math.max(1, n), dayOfMonth: opts.dayOfMonth ?? dayOfMonth };
    } else {
      pattern = {
        type: "monthly_nth_weekday",
        everyN: Math.max(1, n),
        nth: opts.nth ?? nth,
        weekday: opts.nthWeekday ?? nthWeekday,
      };
    }
    onChange({ pattern, mode: m });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <select
        value={type}
        onChange={(e) => {
          const t = e.target.value as PickerType;
          setType(t);
          if (t === "none") onChange(null);
          else emit({ type: t });
        }}
        style={inputStyle}
      >
        <option value="none">Doesn&apos;t repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly_day">Monthly (specific day)</option>
        <option value="monthly_nth">Monthly (Nth weekday)</option>
      </select>

      {type !== "none" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>
            <span>Every</span>
            <input
              type="number"
              min={1}
              value={everyN}
              onChange={(e) => {
                const n = Math.max(1, Number(e.target.value) || 1);
                setEveryN(n);
                emit({ everyN: n });
              }}
              style={{ ...inputStyle, width: 64 }}
            />
            <span>
              {type === "daily" ? "day(s)" :
               type === "weekly" ? "week(s)" :
               "month(s)"}
            </span>
          </div>

          {type === "weekly" && (
            <div>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 6 }}>
                On specific days <span style={{ color: "var(--color-text-tertiary)" }}>(optional — leave empty to repeat any day each week)</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {DAYS.map((d) => {
                  const active = daysOfWeek.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? daysOfWeek.filter((x) => x !== d.value)
                          : [...daysOfWeek, d.value];
                        setDaysOfWeek(next);
                        emit({ daysOfWeek: next });
                      }}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
                        background: active ? "var(--color-accent)" : "white",
                        color: active ? "white" : "var(--color-text-primary)",
                        fontWeight: 600, fontSize: 12,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {type === "monthly_day" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>
              <span>On day</span>
              <input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => {
                  const n = Math.min(31, Math.max(1, Number(e.target.value) || 1));
                  setDayOfMonth(n);
                  emit({ dayOfMonth: n });
                }}
                style={{ ...inputStyle, width: 64 }}
              />
              <span>of the month</span>
            </div>
          )}

          {type === "monthly_nth" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-text-secondary)", flexWrap: "wrap" }}>
              <span>On the</span>
              <select
                value={nth}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setNth(v);
                  emit({ nth: v });
                }}
                style={{ ...inputStyle, width: "auto" }}
              >
                {NTH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={nthWeekday}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setNthWeekday(v);
                  emit({ nthWeekday: v });
                }}
                style={{ ...inputStyle, width: "auto" }}
              >
                {WEEKDAY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <span>of the month</span>
            </div>
          )}

          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>Repeat anchor</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => { setMode("schedule"); emit({ mode: "schedule" }); }}
                style={modeBtnStyle(mode === "schedule")}
              >
                By due date
              </button>
              <button
                type="button"
                onClick={() => { setMode("completion"); emit({ mode: "completion" }); }}
                style={modeBtnStyle(mode === "completion")}
              >
                By completion date
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 6, lineHeight: 1.4 }}>
              {mode === "schedule"
                ? "Next instance is anchored on the original due date — finishing late doesn't shift future tasks."
                : "Next instance is anchored on when you complete it — finish Wed, next one due Wed."}
            </div>
          </div>

          {value && (
            <div style={{
              fontSize: 11, color: "var(--color-text-secondary)",
              padding: "6px 10px", background: "rgba(0,113,227,0.08)",
              borderRadius: 8, marginTop: 4,
            }}>
              🔁 {formatRecurrence(value)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function modeBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 8,
    border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
    background: active ? "rgba(0,113,227,0.08)" : "transparent",
    color: active ? "#0071E3" : "var(--color-text-primary)",
    fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
  };
}
