"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

/* ── Types ── */

interface TimelinePoint {
  label: string;
  count: number;
}

interface LifecycleStage {
  label: string;
  value: string;
  count: number;
}

interface ChartNote {
  id: string;
  date: string;
  text: string;
  author: string;
  createdAt?: string;
}

type LifecycleBreakdown = Record<
  string,
  {
    sources: { label: string; count: number }[];
    actions: { label: string; count: number }[];
  }
>;

interface Metric {
  key: string;
  label: string;
  colour: string;
}

/* ── Constants ── */

const METRICS: Metric[] = [
  { key: "contacts", label: "Contacts", colour: "#6366F1" },
  { key: "prospects", label: "Prospects", colour: "#F59E0B" },
  { key: "leads", label: "Leads", colour: "#0071E3" },
  { key: "visits", label: "Home Visits", colour: "#10B981" },
  { key: "visitors", label: "Visitors", colour: "#8B5CF6" },
];

const WEEKEND_COLOURS: Record<string, string> = {
  "#6366F1": "#A5B4FC",
  "#F59E0B": "#FCD34D",
  "#0071E3": "#7DD3FC",
  "#10B981": "#6EE7B7",
  "#8B5CF6": "#C4B5FD",
};

const LIFECYCLE_COLOURS: Record<string, string> = {
  Prospect: "#8B5CF6",
  "Warm - Prospect": "#A78BFA",
  Lead: "#0071E3",
  "Home Visit/Deal ": "#0EA5E9",
  "Won - Waiting": "#14B8A6",
  Completed: "#10B981",
  Nurture: "#F59E0B",
  "Deal Recovery": "#F97316",
  "Deal Lost": "#EF4444",
  "Cold - Subscribed": "#64748B",
  "Cold - Unsubscribed": "#94A3B8",
  "Suppliers & Muppets": "#CBD5E1",
};

/* ── Date helpers ── */

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function fmt(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function getDefaultRange() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: fmt(monthStart), to: fmt(now) };
}

/* ── Page ── */

export default function TrendsPage() {
  const defaults = getDefaultRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);

  const [selectedMetric, setSelectedMetric] = useState<string>("contacts");
  const [timelineData, setTimelineData] = useState<TimelinePoint[]>([]);
  const [timelineGranularity, setTimelineGranularity] = useState<string>("day");
  const [timelineLoading, setTimelineLoading] = useState(false);

  const [lifecycleStages, setLifecycleStages] = useState<LifecycleStage[]>([]);
  const [lifecyclePeriod, setLifecyclePeriod] = useState<LifecycleStage[]>([]);
  const [lifecycleBreakdown, setLifecycleBreakdown] = useState<LifecycleBreakdown>({});

  const [chartNotes, setChartNotes] = useState<ChartNote[]>([]);
  const [noteEditing, setNoteEditing] = useState<{ date: string; text: string } | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);

  /* Fetch timeline whenever metric or dates change */
  const fetchTimeline = useCallback(
    async (metric: string, fromDate: string, toDate: string) => {
      setTimelineLoading(true);
      try {
        const res = await fetch(
          `/api/hubspot/contacts-daily?from=${fromDate}&to=${toDate}&metric=${metric}`,
        );
        if (res.ok) {
          const json = await res.json();
          setTimelineData(json.data ?? []);
          setTimelineGranularity(json.granularity ?? "day");
        }
      } finally {
        setTimelineLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchTimeline(selectedMetric, from, to);
  }, [selectedMetric, from, to, fetchTimeline]);

  /* Lifecycle — live totals (no dates) */
  useEffect(() => {
    fetch("/api/hubspot/lifecycle-stages")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.stages) setLifecycleStages(data.stages);
      })
      .catch(() => {});
    fetch("/api/hubspot/lifecycle-breakdown")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.stages) setLifecycleBreakdown(data.stages);
      })
      .catch(() => {});
  }, []);

  /* Lifecycle for the selected period */
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/hubspot/lifecycle-stages-period?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.stages) setLifecyclePeriod(data.stages);
        else setLifecyclePeriod([]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  /* Chart notes */
  useEffect(() => {
    fetch("/api/chart-notes")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.notes) setChartNotes(data.notes);
      })
      .catch(() => {});
  }, []);

  /* Quick ranges */
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const threeMonthsStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const ranges = [
    {
      label: "This Month",
      from: fmt(monthStart),
      to: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    },
    { label: "Last Month", from: fmt(lastMonthStart), to: fmt(lastMonthEnd) },
    { label: "Last 3 Months", from: fmt(threeMonthsStart), to: fmt(lastMonthEnd) },
  ];

  const active = METRICS.find((m) => m.key === selectedMetric) ?? METRICS[0];
  const totalCount = timelineData.reduce((s, d) => s + d.count, 0);

  return (
    <div style={{ padding: "28px 28px 48px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: "0 0 4px",
              letterSpacing: "-0.02em",
            }}
          >
            Trends &amp; Lifecycle
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-text-secondary)",
              margin: 0,
            }}
          >
            Timeline chart of contacts, prospects, leads and visits, plus a live
            view of HubSpot lifecycle stages.
          </p>
        </div>

        {/* Date picker */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "2px",
              background: "rgba(0,0,0,0.04)",
              borderRadius: "8px",
              padding: "3px",
            }}
          >
            {ranges.map((r) => {
              const selected = from === r.from && to === r.to;
              return (
                <button
                  key={r.label}
                  onClick={() => {
                    setFrom(r.from);
                    setTo(r.to);
                  }}
                  style={{
                    fontSize: "11px",
                    fontWeight: selected ? 600 : 400,
                    color: selected ? "white" : "#86868B",
                    background: selected ? "#0071E3" : "transparent",
                    border: "none",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s",
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(0,0,0,0.04)",
              borderRadius: "18px",
              padding: "6px 12px",
            }}
          >
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                fontSize: "12px",
                color: "#1D1D1F",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <span style={{ color: "#AEAEB2", fontSize: "12px" }}>→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                fontSize: "12px",
                color: "#1D1D1F",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>
      </div>

      {/* Chart + lifecycle */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* CHART */}
        <div
          style={{
            background: "var(--bg-card, white)",
            borderRadius: "var(--radius-card, 18px)",
            border: "none",
            padding: "14px",
            position: "relative",
            boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "2px",
                background: "#F5F5F7",
                borderRadius: "8px",
                padding: "3px",
              }}
            >
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setSelectedMetric(m.key)}
                  style={{
                    fontSize: "10px",
                    fontWeight: selectedMetric === m.key ? 700 : 500,
                    color: selectedMetric === m.key ? "white" : "#64748B",
                    background:
                      selectedMetric === m.key ? m.colour : "transparent",
                    border: "none",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "10px",
                  color: "#AEAEB2",
                  background: "#F5F5F7",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  fontWeight: 500,
                  textTransform: "capitalize",
                }}
              >
                {timelineGranularity}
              </span>
              <p style={{ fontSize: "11px", color: "#AEAEB2", margin: 0 }}>
                {totalCount.toLocaleString()} total
              </p>
            </div>
          </div>

          {timelineLoading && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 2,
                background: "rgba(255,255,255,0.85)",
                borderRadius: "18px",
                padding: "12px 24px",
              }}
            >
              <p
                style={{
                  fontSize: "13px",
                  color: "#86868B",
                  margin: 0,
                  fontWeight: 600,
                }}
              >
                Loading...
              </p>
            </div>
          )}

          {/* Note editing popover */}
          {noteEditing &&
            (() => {
              const existingNotes = chartNotes
                .filter((n) => n.date === noteEditing.date)
                .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
              return (
                <div
                  style={{
                    background: "#FAFAFA",
                    border: "1px solid #E2E8F0",
                    borderRadius: "12px",
                    padding: "12px",
                    marginBottom: "8px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "#64748B",
                      margin: "0 0 8px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Notes for{" "}
                    {(() => {
                      const [y, m, d] = noteEditing.date.split("-");
                      return `${parseInt(d)}/${parseInt(m)}/${y}`;
                    })()}
                  </p>
                  {existingNotes.length > 0 && (
                    <ul
                      style={{
                        listStyle: "none",
                        margin: "0 0 10px",
                        padding: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      {existingNotes.map((n) => (
                        <li
                          key={n.id}
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "flex-start",
                            background: "#FFFBEB",
                            border: "1px solid #FDE68A",
                            borderRadius: "8px",
                            padding: "6px 8px",
                          }}
                        >
                          <span
                            style={{
                              flex: 1,
                              fontSize: "12px",
                              color: "#92400E",
                              lineHeight: 1.4,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {n.text}
                          </span>
                          <button
                            disabled={noteSaving}
                            onClick={async () => {
                              setNoteSaving(true);
                              const res = await fetch(
                                `/api/chart-notes?id=${encodeURIComponent(n.id)}`,
                                { method: "DELETE" },
                              );
                              if (res.ok) {
                                const data = await res.json();
                                setChartNotes(data.notes);
                              }
                              setNoteSaving(false);
                            }}
                            title="Delete note"
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              background: "transparent",
                              color: "#B91C1C",
                              border: "none",
                              borderRadius: "6px",
                              padding: "2px 6px",
                              cursor: "pointer",
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <textarea
                      value={noteEditing.text}
                      onChange={(e) =>
                        setNoteEditing({ ...noteEditing, text: e.target.value })
                      }
                      placeholder={
                        existingNotes.length > 0
                          ? "Add another note..."
                          : "e.g. Paused Google Ads, changed landing page..."
                      }
                      rows={2}
                      style={{
                        flex: 1,
                        fontSize: "12px",
                        border: "1px solid #E2E8F0",
                        borderRadius: "8px",
                        padding: "8px",
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <button
                        disabled={noteSaving || !noteEditing.text.trim()}
                        onClick={async () => {
                          setNoteSaving(true);
                          const res = await fetch("/api/chart-notes", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              date: noteEditing.date,
                              text: noteEditing.text,
                            }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setChartNotes(data.notes);
                            setNoteEditing({ date: noteEditing.date, text: "" });
                          }
                          setNoteSaving(false);
                        }}
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          background: "#0071E3",
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "6px 12px",
                          cursor: "pointer",
                          opacity:
                            noteSaving || !noteEditing.text.trim() ? 0.5 : 1,
                        }}
                      >
                        {noteSaving ? "..." : "Add"}
                      </button>
                      <button
                        onClick={() => setNoteEditing(null)}
                        style={{
                          fontSize: "11px",
                          color: "#94A3B8",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "4px",
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

          <div
            style={{
              width: "100%",
              height: 360,
              opacity: timelineLoading ? 0.3 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={timelineData}
                  margin={{ top: 16, right: 8, bottom: 0, left: -16 }}
                  onClick={(state) => {
                    if (!state?.activeLabel || timelineGranularity !== "day") return;
                    const date = String(state.activeLabel);
                    setNoteEditing({ date, text: "" });
                  }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(d: string) => {
                      if (timelineGranularity === "day") {
                        const [, m, day] = d.split("-");
                        return `${parseInt(day)}/${parseInt(m)}`;
                      }
                      return d;
                    }}
                    interval={
                      timelineData.length > 20
                        ? Math.floor(timelineData.length / 10)
                        : 0
                    }
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "#F1F5F9" }}
                    content={({ active: isActive, payload, label }) => {
                      if (!isActive || !payload?.length) return null;
                      const dayNotes = chartNotes.filter((n) => n.date === label);
                      return (
                        <div
                          style={{
                            background: "#fff",
                            borderRadius: "12px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                            padding: "10px 14px",
                            fontSize: "12px",
                            maxWidth: "300px",
                            minWidth: "160px",
                          }}
                        >
                          <p
                            style={{
                              margin: "0 0 2px",
                              fontWeight: 600,
                              color: "#1D1D1F",
                            }}
                          >
                            {String(label)}
                          </p>
                          <p
                            style={{
                              margin: "0 0 6px",
                              color: active.colour,
                              fontWeight: 600,
                            }}
                          >
                            {active.label}:{" "}
                            {Number(payload[0].value).toLocaleString()}
                          </p>
                          {dayNotes.length > 0 && (
                            <div
                              style={{
                                margin: "6px 0 0",
                                display: "flex",
                                flexDirection: "column",
                                gap: "4px",
                              }}
                            >
                              {dayNotes.map((n) => (
                                <p
                                  key={n.id ?? n.createdAt}
                                  style={{
                                    margin: 0,
                                    padding: "6px 8px",
                                    background: "#FFFBEB",
                                    borderRadius: "6px",
                                    border: "1px solid #FDE68A",
                                    color: "#92400E",
                                    fontSize: "11px",
                                    lineHeight: 1.4,
                                  }}
                                >
                                  {n.text}
                                </p>
                              ))}
                            </div>
                          )}
                          {timelineGranularity === "day" && dayNotes.length === 0 && (
                            <p style={{ margin: "4px 0 0", color: "#AEAEB2", fontSize: "10px" }}>
                              Click to add a note
                            </p>
                          )}
                          {timelineGranularity === "day" && dayNotes.length > 0 && (
                            <p style={{ margin: "4px 0 0", color: "#AEAEB2", fontSize: "10px" }}>
                              Click to add another
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                  {timelineGranularity === "day" &&
                    Array.from(
                      new Set(
                        chartNotes
                          .filter((n) => timelineData.some((d) => d.label === n.date))
                          .map((n) => n.date),
                      ),
                    ).map((date) => {
                      const count = chartNotes.filter((n) => n.date === date).length;
                      return (
                        <ReferenceLine
                          key={date}
                          x={date}
                          stroke="#F59E0B"
                          strokeDasharray="3 3"
                          strokeWidth={1.5}
                          label={{
                            value: count > 1 ? `✎${count}` : "✎",
                            position: "top",
                            fill: "#F59E0B",
                            fontSize: 12,
                          }}
                        />
                      );
                    })}
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {timelineData.map((d, i) => {
                      let isWeekend = false;
                      if (timelineGranularity === "day") {
                        const dow = new Date(d.label + "T12:00:00").getDay();
                        isWeekend = dow === 0 || dow === 6;
                      }
                      if (!isWeekend) return <Cell key={i} fill={active.colour} />;
                      return (
                        <Cell
                          key={i}
                          fill={WEEKEND_COLOURS[active.colour] ?? "#E2E8F0"}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#AEAEB2",
                  fontSize: "13px",
                }}
              >
                Select a metric to see the trend
              </div>
            )}
          </div>
        </div>

        {/* Lifecycle pipeline */}
        {lifecycleStages.length > 0 && (
          <LifecyclePipeline
            stages={lifecycleStages}
            periodStages={lifecyclePeriod}
            stageBreakdown={lifecycleBreakdown}
          />
        )}
      </div>
    </div>
  );
}

/* ── LifecyclePipeline (extracted from overview page) ── */

function LifecyclePipeline({
  stages,
  periodStages,
  stageBreakdown,
}: {
  stages: LifecycleStage[];
  periodStages: LifecycleStage[];
  stageBreakdown?: LifecycleBreakdown;
}) {
  const total = stages.reduce((s, st) => s + st.count, 0);
  const periodMap = new Map(periodStages.map((s) => [s.value, s.count]));
  const hasPeriod = periodStages.length > 0;
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const featuredOrder = [
    "Cold - Unsubscribed",
    "Cold - Subscribed",
    "Prospect",
    "Lead",
  ];
  const featuredStages = featuredOrder
    .map((label) => stages.find((s) => s.label === label))
    .filter((s): s is LifecycleStage => !!s);
  const featuredLabels = new Set(featuredOrder);
  const otherStages = stages.filter(
    (s) => !featuredLabels.has(s.label) && s.count > 0,
  );
  const maxCount = Math.max(...featuredStages.map((s) => s.count), 1);
  const allStagesOrdered = [...featuredStages, ...otherStages];

  function renderBreakdown(stageValue: string, colour: string) {
    const bd = stageBreakdown?.[stageValue];
    if (!bd || (bd.sources.length === 0 && bd.actions.length === 0)) return null;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginTop: "8px",
        }}
      >
        {bd.sources.length > 0 && (
          <div>
            <p
              style={{
                fontSize: "9px",
                fontWeight: 600,
                color: "#AEAEB2",
                margin: "0 0 4px",
                textTransform: "uppercase",
                letterSpacing: "0.6px",
              }}
            >
              Lead Source
            </p>
            {bd.sources.slice(0, 6).map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "2px 0",
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    color: "#64748B",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    marginRight: "6px",
                  }}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    color: colour,
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                  }}
                >
                  {s.count.toLocaleString()}
                </span>
              </div>
            ))}
            {bd.sources.length > 6 && (
              <p style={{ fontSize: "9px", color: "#AEAEB2", margin: "2px 0 0" }}>
                +{bd.sources.length - 6} more
              </p>
            )}
          </div>
        )}
        {bd.actions.length > 0 && (
          <div>
            <p
              style={{
                fontSize: "9px",
                fontWeight: 600,
                color: "#AEAEB2",
                margin: "0 0 4px",
                textTransform: "uppercase",
                letterSpacing: "0.6px",
              }}
            >
              Conversion Action
            </p>
            {bd.actions.slice(0, 6).map((a) => (
              <div
                key={a.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "2px 0",
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    color: "#64748B",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    marginRight: "6px",
                  }}
                >
                  {a.label}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    color: colour,
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                  }}
                >
                  {a.count.toLocaleString()}
                </span>
              </div>
            ))}
            {bd.actions.length > 6 && (
              <p style={{ fontSize: "9px", color: "#AEAEB2", margin: "2px 0 0" }}>
                +{bd.actions.length - 6} more
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-card, white)",
        borderRadius: "20px",
        border: "none",
        boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
        padding: "16px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <p
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#86868B",
              margin: 0,
            }}
          >
            Lifecycle Stages
          </p>
          <span
            style={{
              fontSize: "10px",
              color: "#AEAEB2",
              background: "#F5F5F7",
              borderRadius: "6px",
              padding: "2px 8px",
              fontWeight: 500,
            }}
          >
            Live totals
          </span>
        </div>
        <p
          style={{
            fontSize: "12px",
            color: "#AEAEB2",
            margin: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span style={{ fontWeight: 600, color: "#1D1D1F", fontSize: "15px" }}>
            {total.toLocaleString()}
          </span>{" "}
          contacts
        </p>
      </div>

      <div style={{ display: "flex", gap: "20px", alignItems: "stretch" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            padding: "8px 0",
          }}
        >
          {featuredStages.map((stage, i) => {
            const colour = LIFECYCLE_COLOURS[stage.label] ?? "#94A3B8";
            const sizeScale = Math.max(0.5, stage.count / maxCount);
            const size = Math.round(54 + sizeScale * 36);
            const periodCount = periodMap.get(stage.value) ?? 0;
            const isLead = stage.label === "Lead";
            const pct = total > 0 ? ((stage.count / total) * 100).toFixed(1) : "0.0";

            return (
              <div
                key={stage.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                  justifyContent: "center",
                }}
              >
                {i > 0 && (
                  <svg
                    width="40"
                    height="20"
                    viewBox="0 0 40 20"
                    style={{ flexShrink: 0, opacity: 0.4 }}
                  >
                    <line
                      x1="0"
                      y1="10"
                      x2="30"
                      y2="10"
                      stroke="#CBD5E1"
                      strokeWidth="2"
                    />
                    <polygon points="30,5 40,10 30,15" fill="#CBD5E1" />
                  </svg>
                )}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                    flexShrink: 0,
                  }}
                >
                  <div
                    title={`${stage.label}: ${stage.count.toLocaleString()} (${pct}%)`}
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      borderRadius: "50%",
                      background: isLead
                        ? `radial-gradient(circle at 30% 30%, ${colour}30, ${colour}12)`
                        : `radial-gradient(circle at 30% 30%, ${colour}20, ${colour}08)`,
                      border: `${isLead ? "3.5px" : "2.5px"} solid ${colour}`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "2px",
                      transition: "all 0.3s ease",
                      boxShadow: isLead
                        ? `0 0 20px ${colour}35, 0 0 40px ${colour}15`
                        : `0 2px 8px ${colour}15`,
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      setExpandedStage(
                        expandedStage === stage.value ? null : stage.value,
                      )
                    }
                  >
                    <span
                      style={{
                        fontSize: size > 72 ? "17px" : size > 60 ? "14px" : "12px",
                        fontWeight: 600,
                        color: colour,
                        lineHeight: 1,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {stage.count.toLocaleString()}
                    </span>
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 600,
                        color: `${colour}99`,
                        lineHeight: 1,
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: isLead ? 800 : 600,
                      color: isLead ? colour : "#86868B",
                      textAlign: "center",
                      lineHeight: 1.2,
                    }}
                  >
                    {stage.label}
                  </span>
                  {hasPeriod && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        color: periodCount > 0 ? "#059669" : "#CBD5E1",
                        background: periodCount > 0 ? "#ECFDF5" : "#F8FAFC",
                        borderRadius: "18px",
                        padding: "3px 12px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {periodCount > 0 ? `+${periodCount.toLocaleString()}` : "—"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {otherStages.length > 0 && (
          <div
            style={{
              width: "1px",
              background: "#E2E8F0",
              alignSelf: "stretch",
              margin: "8px 0",
            }}
          />
        )}

        {otherStages.length > 0 && (
          <div
            style={{
              minWidth: "190px",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <p
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#AEAEB2",
                margin: "0 0 8px",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
              }}
            >
              Other Stages
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {otherStages.map((stage) => {
                const colour = LIFECYCLE_COLOURS[stage.label] ?? "#94A3B8";
                const periodCount = periodMap.get(stage.value) ?? 0;
                return (
                  <div
                    key={stage.value}
                    onClick={() =>
                      setExpandedStage(
                        expandedStage === stage.value ? null : stage.value,
                      )
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "7px 10px",
                      borderRadius: "8px",
                      gap: "10px",
                      background:
                        expandedStage === stage.value
                          ? `${colour}08`
                          : "#FAFBFC",
                      cursor: "pointer",
                      border:
                        expandedStage === stage.value
                          ? `1px solid ${colour}30`
                          : "1px solid transparent",
                      transition: "all 0.15s",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: colour,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        color: "#86868B",
                        fontWeight: 500,
                        fontSize: "11px",
                        flex: 1,
                      }}
                    >
                      {stage.label}
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: "#1D1D1F",
                        fontSize: "12px",
                        fontVariantNumeric: "tabular-nums",
                        minWidth: "36px",
                        textAlign: "right",
                      }}
                    >
                      {stage.count.toLocaleString()}
                    </span>
                    {hasPeriod && (
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "10px",
                          color: periodCount > 0 ? "#059669" : "#CBD5E1",
                          fontVariantNumeric: "tabular-nums",
                          minWidth: "28px",
                          textAlign: "right",
                        }}
                      >
                        {periodCount > 0 ? `+${periodCount}` : "—"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {hasPeriod && (
        <p
          style={{
            fontSize: "10px",
            color: "#AEAEB2",
            margin: "10px 0 0",
            textAlign: "center",
          }}
        >
          Green badges show contacts created in the selected date range — click a
          stage to see breakdown
        </p>
      )}

      {expandedStage &&
        (() => {
          const stage = allStagesOrdered.find((s) => s.value === expandedStage);
          if (!stage) return null;
          const colour = LIFECYCLE_COLOURS[stage.label] ?? "#94A3B8";
          const hasBreakdownData = Object.keys(stageBreakdown ?? {}).length > 0;
          const bd = renderBreakdown(stage.value, colour);
          if (!hasBreakdownData)
            return (
              <div
                style={{
                  borderTop: "1px solid #F1F5F9",
                  marginTop: "12px",
                  paddingTop: "12px",
                }}
              >
                <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>
                  Loading breakdown for {stage.label}...
                </p>
              </div>
            );
          if (!bd)
            return (
              <div
                style={{
                  borderTop: "1px solid #F1F5F9",
                  marginTop: "12px",
                  paddingTop: "12px",
                }}
              >
                <p style={{ fontSize: "11px", color: "#AEAEB2", margin: 0 }}>
                  No breakdown data available for {stage.label}
                </p>
              </div>
            );
          return (
            <div
              style={{
                borderTop: "1px solid #F1F5F9",
                marginTop: "12px",
                paddingTop: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "4px",
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: colour,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "12px", fontWeight: 600, color: colour }}>
                  {stage.label}
                </span>
                <span style={{ fontSize: "11px", color: "#AEAEB2" }}>
                  {stage.count.toLocaleString()} contacts
                </span>
                <button
                  onClick={() => setExpandedStage(null)}
                  style={{
                    marginLeft: "auto",
                    fontSize: "10px",
                    color: "#94A3B8",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px 6px",
                  }}
                >
                  Close
                </button>
              </div>
              {bd}
            </div>
          );
        })()}
    </div>
  );
}
