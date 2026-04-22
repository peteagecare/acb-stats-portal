"use client";

import { useEffect, useState } from "react";

/* ── Types ── */

interface Source {
  value: string;
  label: string;
  count: number;
}

interface ByCategory {
  total: number;
  sources: Source[];
}

interface ContactsBySourceResponse {
  byCategory: {
    PPC: ByCategory;
    SEO: ByCategory;
    Content: ByCategory;
    TV: ByCategory;
    Other: ByCategory;
  };
}

interface SourceBreakdownResponse {
  breakdown: Record<string, { prospects: number; leads: number }>;
}

interface Goals {
  contactsGoalPerMonth: number | null;
  ppcGoalPerMonth: number | null;
  seoGoalPerMonth: number | null;
  contentGoalPerMonth: number | null;
  tvGoalPerMonth: number | null;
  ppcPercentGoal: number | null;
  seoPercentGoal: number | null;
  contentPercentGoal: number | null;
  tvPercentGoal: number | null;
}

/* ── Constants ── */

/** Sources in "Other" redistributed evenly across PPC, SEO, Content */
const REDISTRIBUTED_SOURCES = new Set(["Direct", "Phone Call", "(No value)", "__no_value__"]);

type TeamKey = "PPC" | "SEO" | "Content" | "TV";

interface TeamMeta {
  title: TeamKey;
  subtitle: string;
  colour: string;
  bg: string;
}

const TEAMS: TeamMeta[] = [
  { title: "PPC", subtitle: "Paid ads", colour: "#EF4444", bg: "#FEF2F2" },
  { title: "SEO", subtitle: "Organic search", colour: "#10B981", bg: "#ECFDF5" },
  { title: "Content", subtitle: "Social & video", colour: "#8B5CF6", bg: "#F5F3FF" },
  { title: "TV", subtitle: "Television", colour: "#F97316", bg: "#FFF7ED" },
];

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

function proratedGoal(monthlyGoal: number | null, from: string, to: string): number | null {
  if (!monthlyGoal || monthlyGoal <= 0) return null;
  const fromDate = new Date(from + "T00:00:00");
  const toDate = new Date(to + "T23:59:59");
  const rangeDays = Math.max(
    1,
    Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
  return Math.max(1, Math.round((monthlyGoal / 30.44) * rangeDays));
}

/* ── Page ── */

export default function TeamsPage() {
  const defaults = getDefaultRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);

  const [contactsBySource, setContactsBySource] =
    useState<ContactsBySourceResponse | null>(null);
  const [sourceBreakdown, setSourceBreakdown] =
    useState<SourceBreakdownResponse["breakdown"]>({});
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Fetch data when date range changes */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/hubspot/contacts-by-source?from=${from}&to=${to}`).then((r) =>
        r.ok ? r.json() : Promise.reject(`contacts-by-source ${r.status}`),
      ),
      fetch(`/api/hubspot/source-breakdown?from=${from}&to=${to}`).then((r) =>
        r.ok ? r.json() : Promise.reject(`source-breakdown ${r.status}`),
      ),
    ])
      .then(([cbs, sb]: [ContactsBySourceResponse, SourceBreakdownResponse]) => {
        if (cancelled) return;
        setContactsBySource(cbs);
        setSourceBreakdown(sb.breakdown ?? {});
      })
      .catch((e) => {
        if (!cancelled) setError(typeof e === "string" ? e : "Failed to load data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [from, to]);

  /* Goals load once */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/goals")
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (!cancelled && g) setGoals(g as Goals);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /* Quick date ranges */
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

  /* ── Compute per-team totals + redistributed "shared" slices ── */
  const cats = contactsBySource?.byCategory;

  // Sum of all sources across categories — used for "% of contacts" denominator
  const sourcesTotal = cats
    ? cats.PPC.total + cats.SEO.total + cats.Content.total + cats.TV.total + cats.Other.total
    : 0;

  // From the "Other" bucket, isolate Direct / Phone Call / (No value) for even redistribution
  const otherSources: Source[] = cats?.Other.sources ?? [];
  const redistSources = otherSources.filter(
    (s) => REDISTRIBUTED_SOURCES.has(s.value) || REDISTRIBUTED_SOURCES.has(s.label),
  );
  const redistTotal = redistSources.reduce((sum, s) => sum + s.count, 0);
  const redistPerTeam = Math.round(redistTotal / 3);
  const redistPerTeamRemainder = redistTotal - redistPerTeam * 3; // remainder → PPC

  const ppcRedistCount = redistPerTeam + redistPerTeamRemainder;
  const seoRedistCount = redistPerTeam;
  const contentRedistCount = redistPerTeam;

  /** Per-source shared rows labelled "(shared)" — proportional split */
  const redistLabel = (teamShare: number): Source[] =>
    redistTotal === 0
      ? []
      : redistSources
          .filter((s) => s.count > 0)
          .map((s) => ({
            value: s.value,
            label: `${s.label} (shared)`,
            count: Math.round((s.count / redistTotal) * teamShare),
          }));

  const teamData: Record<
    TeamKey,
    { native: Source[]; shared: Source[]; total: number; sharedTotal: number }
  > = {
    PPC: {
      native: cats?.PPC.sources ?? [],
      shared: redistLabel(ppcRedistCount),
      total: (cats?.PPC.total ?? 0) + ppcRedistCount,
      sharedTotal: ppcRedistCount,
    },
    SEO: {
      native: cats?.SEO.sources ?? [],
      shared: redistLabel(seoRedistCount),
      total: (cats?.SEO.total ?? 0) + seoRedistCount,
      sharedTotal: seoRedistCount,
    },
    Content: {
      native: cats?.Content.sources ?? [],
      shared: redistLabel(contentRedistCount),
      total: (cats?.Content.total ?? 0) + contentRedistCount,
      sharedTotal: contentRedistCount,
    },
    TV: {
      native: cats?.TV.sources ?? [],
      shared: [],
      total: cats?.TV.total ?? 0,
      sharedTotal: 0,
    },
  };

  function getTeamGoal(team: TeamKey): number | null {
    if (!goals) return null;
    const pct =
      team === "PPC"
        ? goals.ppcPercentGoal
        : team === "SEO"
          ? goals.seoPercentGoal
          : team === "Content"
            ? goals.contentPercentGoal
            : goals.tvPercentGoal;
    const absolute =
      team === "PPC"
        ? goals.ppcGoalPerMonth
        : team === "SEO"
          ? goals.seoGoalPerMonth
          : team === "Content"
            ? goals.contentGoalPerMonth
            : goals.tvGoalPerMonth;
    const monthly =
      goals.contactsGoalPerMonth && pct
        ? Math.round((goals.contactsGoalPerMonth * pct) / 100)
        : absolute;
    return proratedGoal(monthly, from, to);
  }

  function getTeamGoalPercent(team: TeamKey): number | null {
    if (!goals) return null;
    return team === "PPC"
      ? goals.ppcPercentGoal
      : team === "SEO"
        ? goals.seoPercentGoal
        : team === "Content"
          ? goals.contentPercentGoal
          : goals.tvPercentGoal;
  }

  return (
    <div style={{ padding: "28px 28px 48px", maxWidth: 1400, margin: "0 auto" }}>
      {/* ── Page header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "8px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "var(--color-text-primary, #1D1D1F)",
              margin: 0,
              letterSpacing: "-0.3px",
            }}
          >
            Contacts Per Team
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-text-secondary, #86868B)",
              margin: "4px 0 0",
            }}
          >
            How contacts break down across PPC, SEO, Content and TV teams. Direct,
            Phone Call and untagged contacts are shared evenly across PPC / SEO /
            Content.
          </p>
        </div>

        {/* Date range picker */}
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

      {/* ── Error / loading ── */}
      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#DC2626",
            borderRadius: "12px",
            padding: "10px 14px",
            marginTop: "16px",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      {loading && !contactsBySource && (
        <div
          style={{
            marginTop: "24px",
            padding: "40px",
            textAlign: "center",
            color: "#86868B",
            fontSize: "13px",
          }}
        >
          Loading per-team contacts…
        </div>
      )}

      {/* ── Team cards grid ── */}
      {contactsBySource && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "14px",
            marginTop: "24px",
          }}
          className="teams-grid"
        >
          {TEAMS.map((meta) => {
            const td = teamData[meta.title];
            const bd = sourceBreakdown[meta.title];
            return (
              <TeamCard
                key={meta.title}
                meta={meta}
                total={td.total}
                nativeSources={td.native}
                sharedSources={td.shared}
                sharedTotal={td.sharedTotal}
                sharedGrandTotal={
                  meta.title === "TV" ? undefined : redistTotal || undefined
                }
                sourcesTotal={sourcesTotal}
                breakdown={bd}
                goalPercent={getTeamGoalPercent(meta.title)}
                teamGoal={getTeamGoal(meta.title)}
              />
            );
          })}
        </div>
      )}

      {/* Responsive: stack on small screens */}
      <style jsx>{`
        @media (max-width: 1100px) {
          :global(.teams-grid) {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 640px) {
          :global(.teams-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ── TeamCard (inlined from legacy SourcePanel) ── */

function TeamCard({
  meta,
  total,
  nativeSources,
  sharedSources,
  sharedTotal,
  sharedGrandTotal,
  sourcesTotal,
  breakdown,
  goalPercent,
  teamGoal,
}: {
  meta: TeamMeta;
  total: number;
  nativeSources: Source[];
  sharedSources: Source[];
  sharedTotal: number;
  sharedGrandTotal?: number;
  sourcesTotal: number;
  breakdown?: { prospects: number; leads: number };
  goalPercent: number | null;
  teamGoal: number | null;
}) {
  const filteredNative = nativeSources
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const filteredShared = sharedSources
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const pct = sourcesTotal > 0 ? (total / sourcesTotal) * 100 : 0;
  const pctStr = pct.toFixed(1);

  return (
    <div
      style={{
        background: "var(--bg-card, #FFFFFF)",
        borderRadius: "var(--radius-card, 18px)",
        padding: "16px",
        border: "none",
        boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Header: dot + name + big number/goal */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "10px",
              background: meta.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: meta.colour,
              }}
            />
          </div>
          <div>
            <p
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--color-text-primary, #1D1D1F)",
                margin: 0,
              }}
            >
              {meta.title}
            </p>
            <p
              style={{
                fontSize: "11px",
                color: "var(--color-text-tertiary, #AEAEB2)",
                margin: "1px 0 0",
              }}
            >
              {meta.subtitle}
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "flex-end",
              gap: "6px",
            }}
          >
            <p
              style={{
                fontSize: "26px",
                fontWeight: 600,
                color: meta.colour,
                margin: 0,
                lineHeight: 1,
              }}
            >
              {total.toLocaleString()}
            </p>
            {teamGoal != null && teamGoal > 0 && (
              <p
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: total >= teamGoal ? "#059669" : "#94A3B8",
                  margin: 0,
                  lineHeight: 1,
                }}
              >
                / {teamGoal.toLocaleString()}
              </p>
            )}
          </div>
          <p
            style={{
              fontSize: "11px",
              color: "var(--color-text-tertiary, #AEAEB2)",
              margin: "3px 0 0",
            }}
          >
            {pctStr}%
          </p>
        </div>
      </div>

      {/* Prospects + Leads */}
      {breakdown && (breakdown.prospects > 0 || breakdown.leads > 0) && (
        <div style={{ display: "flex", gap: "8px" }}>
          <div
            style={{
              flex: 1,
              background: "#FFFBEB",
              borderRadius: "10px",
              padding: "8px 12px",
              border: "1px solid #FDE68A",
            }}
          >
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#92400E", margin: 0 }}>
              Prospects
            </p>
            <p
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "#B45309",
                margin: "2px 0 0",
                lineHeight: 1,
              }}
            >
              {breakdown.prospects.toLocaleString()}
            </p>
          </div>
          <div
            style={{
              flex: 1,
              background: "#EFF6FF",
              borderRadius: "10px",
              padding: "8px 12px",
              border: "1px solid #BFDBFE",
            }}
          >
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#1E40AF", margin: 0 }}>
              Leads
            </p>
            <p
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "#1D4ED8",
                margin: "2px 0 0",
                lineHeight: 1,
              }}
            >
              {breakdown.leads.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Goal vs actual */}
      {goalPercent != null && goalPercent > 0 && (
        <div
          style={{
            background: "#FAFAFA",
            borderRadius: "10px",
            padding: "8px 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "11px", color: "#86868B" }}>
            Goal: <strong>{goalPercent}%</strong> of contacts
          </span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: pct >= goalPercent ? "#059669" : "#DC2626",
              background: pct >= goalPercent ? "#ECFDF5" : "#FEF2F2",
              borderRadius: "6px",
              padding: "2px 8px",
            }}
          >
            {pct >= goalPercent
              ? "On target"
              : `${(goalPercent - pct).toFixed(1)}% below`}
          </span>
        </div>
      )}

      {/* Progress bar with optional goal marker */}
      <div
        style={{
          background: "#F5F5F7",
          borderRadius: "4px",
          height: "4px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${sourcesTotal > 0 ? (total / sourcesTotal) * 100 : 0}%`,
            height: "100%",
            background: meta.colour,
            borderRadius: "4px",
            transition: "width 0.4s ease",
          }}
        />
        {goalPercent != null && goalPercent > 0 && (
          <div
            style={{
              position: "absolute",
              left: `${goalPercent}%`,
              top: "-2px",
              width: "2px",
              height: "8px",
              background: "#0F172A",
              borderRadius: "1px",
              opacity: 0.5,
            }}
            title={`Goal: ${goalPercent}%`}
          />
        )}
      </div>

      {/* Native source rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {filteredNative.length === 0 && (
          <p style={{ fontSize: "11px", color: "#D2D2D7", margin: 0 }}>No data</p>
        )}
        {filteredNative.map((s) => (
          <div
            key={s.value}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "12px", color: "#3A3A3C" }}>{s.label}</span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-text-primary, #1D1D1F)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {s.count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* Shared numbers footer */}
      {sharedTotal > 0 && (
        <div
          style={{
            borderTop: "1px solid #F1F5F9",
            paddingTop: "10px",
            marginTop: "2px",
          }}
        >
          {sharedGrandTotal != null && sharedGrandTotal > 0 && (
            <p style={{ fontSize: "10px", color: "#AEAEB2", margin: "0 0 6px" }}>
              {sharedGrandTotal.toLocaleString()} total shared across 3 teams
            </p>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "6px",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748B" }}>
              Shared numbers
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: meta.colour,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              +{sharedTotal.toLocaleString()}
            </span>
          </div>
          {filteredShared.map((s) => (
            <div
              key={s.value}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "2px",
              }}
            >
              <span style={{ fontSize: "10px", color: "#94A3B8" }}>
                {s.label.replace(" (shared)", "")}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 500,
                  color: "#94A3B8",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
