"use client";

import { useEffect, useState } from "react";

interface LeadCreationTimeline {
  total: number;
  funnel: { label: string; count: number; colour: string }[];
  sources: {
    label: string;
    contacts: number;
    prospects: number;
    leads: number;
    homeVisits: number;
    wonJobs: number;
    lostJobs: number;
  }[];
}

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

export default function LeadTimelinePage() {
  const defaults = getDefaultRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [data, setData] = useState<LeadCreationTimeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/hubspot/lead-creation-timeline?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: LeadCreationTimeline) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError("Failed to load lead creation timeline");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const threeMonthsStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);

  const ranges = [
    { label: "This Month", from: fmt(monthStart), to: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)) },
    { label: "Last Month", from: fmt(lastMonthStart), to: fmt(lastMonthEnd) },
    { label: "Last 3 Months", from: fmt(threeMonthsStart), to: fmt(lastMonthEnd) },
  ];

  const total = data?.total ?? 0;
  const funnelSteps = (data?.funnel ?? []).filter((f) => f.label !== "Contacts");
  const sources = data?.sources ?? [];
  const topSources = sources.slice(0, 8);

  return (
    <div style={{ padding: "28px 28px 48px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "var(--color-text-primary, #1D1D1F)",
              margin: "0 0 4px",
              letterSpacing: "-0.4px",
            }}
          >
            Lead Timeline
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-text-secondary, #86868B)",
              margin: 0,
            }}
          >
            Cohort view of every contact created in the selected period — follow them through the funnel.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
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
              const active = from === r.from && to === r.to;
              return (
                <button
                  key={r.label}
                  onClick={() => {
                    setFrom(r.from);
                    setTo(r.to);
                  }}
                  style={{
                    fontSize: "11px",
                    fontWeight: active ? 600 : 400,
                    color: active ? "white" : "#86868B",
                    background: active ? "var(--color-accent, #0071E3)" : "transparent",
                    border: "none",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s var(--ease-apple, ease)",
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
              borderRadius: "var(--radius-pill, 999px)",
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
                color: "var(--color-text-primary, #1D1D1F)",
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
                color: "var(--color-text-primary, #1D1D1F)",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>
      </div>

      {/* Summary card */}
      <div
        style={{
          background: "var(--bg-card, white)",
          borderRadius: "var(--radius-card, 18px)",
          boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
          padding: "24px 28px",
          marginBottom: "12px",
        }}
      >
        <p
          style={{
            fontSize: "17px",
            fontWeight: 600,
            color: "var(--color-text-primary, #1D1D1F)",
            margin: "0 0 4px",
            letterSpacing: "-0.2px",
          }}
        >
          Lead Creation Timeline
        </p>
        <p style={{ fontSize: "13px", color: "var(--color-text-secondary, #86868B)", margin: 0 }}>
          {loading && !data ? (
            "Loading…"
          ) : error ? (
            <span style={{ color: "#D93D42" }}>{error}</span>
          ) : total === 0 ? (
            "No contacts were created in this period."
          ) : (
            <>
              <strong style={{ color: "#6366F1" }}>{total.toLocaleString()}</strong> contacts were created in this period — here is where they are now
            </>
          )}
        </p>
      </div>

      {/* Funnel + By Source */}
      {data && total > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {/* Funnel bars */}
          <div
            style={{
              background: "var(--bg-card, white)",
              borderRadius: "var(--radius-card, 18px)",
              boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
              padding: "20px",
            }}
          >
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--color-text-secondary, #86868B)",
                margin: "0 0 16px",
                textTransform: "uppercase",
              }}
            >
              Funnel Breakdown
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {funnelSteps.map((step) => {
                const pct = total > 0 ? (step.count / total) * 100 : 0;
                return (
                  <div key={step.label}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: "6px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "3px",
                            background: step.colour,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text-primary, #1D1D1F)" }}>
                          {step.label}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                        <span style={{ fontSize: "18px", fontWeight: 600, color: step.colour, lineHeight: 1 }}>
                          {step.count.toLocaleString()}
                        </span>
                        <span style={{ fontSize: "11px", fontWeight: 400, color: "#AEAEB2" }}>
                          ({pct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        height: "8px",
                        borderRadius: "4px",
                        background: "#F1F5F9",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          borderRadius: "4px",
                          background: step.colour,
                          width: `${pct}%`,
                          minWidth: step.count > 0 ? "4px" : "0",
                          transition: "width 0.4s var(--ease-apple, ease)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By Source */}
          <div
            style={{
              background: "var(--bg-card, white)",
              borderRadius: "var(--radius-card, 18px)",
              boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
              padding: "20px",
            }}
          >
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--color-text-secondary, #86868B)",
                margin: "0 0 16px",
                textTransform: "uppercase",
              }}
            >
              By Source
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {topSources.map((s) => {
                const sourceCol =
                  s.label === "(No source)"
                    ? "#94A3B8"
                    : ["Google Ads", "Bing Ads", "Facebook Ads"].includes(s.label)
                    ? "#0071E3"
                    : ["Organic Search", "AI", "Directory Referral"].includes(s.label)
                    ? "#10B981"
                    : ["Organic Social", "Organic YouTube"].includes(s.label)
                    ? "#8B5CF6"
                    : "#64748B";
                return (
                  <div key={s.label}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: "6px",
                      }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-primary, #1D1D1F)" }}>
                        {s.label}
                      </span>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: sourceCol }}>{s.contacts}</span>
                    </div>
                    <div
                      style={{
                        height: "8px",
                        borderRadius: "4px",
                        background: "#F1F5F9",
                        overflow: "hidden",
                        display: "flex",
                      }}
                    >
                      {[
                        { count: s.wonJobs, col: "#059669" },
                        { count: s.homeVisits, col: "#10B981" },
                        { count: s.leads, col: "#0071E3" },
                        { count: s.prospects, col: "#F59E0B" },
                        { count: s.lostJobs, col: "#EF4444" },
                      ]
                        .filter((seg) => seg.count > 0)
                        .map((seg, i) => (
                          <div
                            key={i}
                            style={{
                              height: "100%",
                              background: seg.col,
                              width: `${(seg.count / s.contacts) * 100}%`,
                              minWidth: "3px",
                            }}
                          />
                        ))}
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                      {s.prospects > 0 && (
                        <span style={{ fontSize: "10px", color: "#F59E0B" }}>
                          {s.prospects} prospect{s.prospects !== 1 ? "s" : ""}
                        </span>
                      )}
                      {s.leads > 0 && (
                        <span style={{ fontSize: "10px", color: "#0071E3" }}>
                          {s.leads} lead{s.leads !== 1 ? "s" : ""}
                        </span>
                      )}
                      {s.homeVisits > 0 && (
                        <span style={{ fontSize: "10px", color: "#10B981" }}>
                          {s.homeVisits} visit{s.homeVisits !== 1 ? "s" : ""}
                        </span>
                      )}
                      {s.wonJobs > 0 && (
                        <span style={{ fontSize: "10px", color: "#059669" }}>{s.wonJobs} won</span>
                      )}
                      {s.lostJobs > 0 && (
                        <span style={{ fontSize: "10px", color: "#EF4444" }}>{s.lostJobs} lost</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {sources.length > 8 && (
                <p
                  style={{
                    fontSize: "10px",
                    color: "#AEAEB2",
                    margin: "2px 0 0",
                    textAlign: "center",
                  }}
                >
                  + {sources.length - 8} more sources
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
