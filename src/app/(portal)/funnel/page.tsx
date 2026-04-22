"use client";

import React, { useEffect, useState, useMemo } from "react";

/* ─────────────────────────────────────────────────────────────
   Customer Funnel — top-of-funnel KPIs for the whole business.
   Per-team breakdown lives on /teams (do not duplicate here).
   ───────────────────────────────────────────────────────────── */

interface Goals {
  leadGoalPerMonth: number | null;
  prospectsGoalPerMonth: number | null;
  visitsGoalPerMonth: number | null;
  contactsGoalPerMonth: number | null;
  siteVisitsGoalPerWeek: number | null;
  installsGoalPerMonth: number | null;
}

const DEFAULT_GOALS: Goals = {
  leadGoalPerMonth: null,
  prospectsGoalPerMonth: null,
  visitsGoalPerMonth: null,
  contactsGoalPerMonth: null,
  siteVisitsGoalPerWeek: null,
  installsGoalPerMonth: 32,
};

interface ConversionAction {
  label: string;
  value: string;
  count: number;
}

interface PreviousPeriod {
  contacts: number;
  prospects: number;
  leads: number;
  homeVisits: number;
  wonJobs: number;
  wonValue: number;
  from: string;
  to: string;
}

const PROSPECT_ACTIONS = [
  "Brochure Download Form",
  "Flipbook Form",
  "VAT Exempt Checker",
  "Pricing Guide",
  "Physical Brochure Request",
  "Newsletter Sign Up",
];
const LEAD_ACTIONS = [
  "Brochure - Call Me",
  "Request A Callback Form",
  "Contact Form",
  "Free Home Design Form",
  "Phone Call",
  "Walk In Bath Form",
  "Direct Email",
  "Brochure - Home Visit",
  "Pricing Guide Home Visit",
];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function fmtDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function getDefaultRange() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: fmtDate(monthStart), to: fmtDate(now) };
}
function gbp(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return `£${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `£${Math.round(n).toLocaleString()}`;
}

/* ── KPI icons (copied from overview for visual parity) ── */
const KPI_ICONS: Record<string, { icon: React.ReactNode; bg: string }> = {
  Contacts: {
    bg: "#EDE9FE",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" stroke="#6366F1" strokeWidth="2" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  Prospects: {
    bg: "#FFFBEB",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  Leads: {
    bg: "#EFF6FF",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#0071E3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  "Home Visits": {
    bg: "#ECFDF5",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 22V12h6v10" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  "Won Jobs": {
    bg: "#ECFDF5",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  "Won Value": {
    bg: "#F3F0FF",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  Pipeline: {
    bg: "#FEF3C7",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 7h16M4 12h10M4 17h7" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
};

/* ── KpiCard — reproduced from overview page ── */
function KpiCard({
  label,
  value,
  displayValue,
  colour,
  subtitle,
  goal,
  comparison,
}: {
  label: string;
  value: number | null;
  displayValue?: string;
  colour: string;
  subtitle?: string;
  goal?: { current: number; target: number };
  comparison?: { current: number; previous: number };
}) {
  const pct = goal ? Math.min((goal.current / goal.target) * 100, 100) : 0;
  const met = goal ? goal.current >= goal.target : false;
  const kpiIcon = KPI_ICONS[label];

  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: "20px",
        boxShadow: "var(--shadow-card)",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        transition: "box-shadow 0.15s var(--ease-apple)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {kpiIcon && (
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: kpiIcon.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {kpiIcon.icon}
          </div>
        )}
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
          {label}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: "28px",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            lineHeight: 1,
            letterSpacing: "-0.5px",
          }}
        >
          {displayValue ?? (value !== null ? value.toLocaleString() : "—")}
        </span>
        {comparison && (() => {
          const delta = comparison.current - comparison.previous;
          const better = delta >= 0;
          return (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: better ? "#059669" : "#DC2626",
                background: better ? "#F0FDF4" : "#FEF2F2",
                borderRadius: "6px",
                padding: "2px 6px",
              }}
            >
              {better ? "↑" : "↓"} {Math.abs(delta).toLocaleString()}
            </span>
          );
        })()}
      </div>

      {subtitle && (
        <p
          style={{
            fontSize: "12px",
            color: "var(--color-text-tertiary)",
            fontWeight: 400,
            margin: 0,
          }}
        >
          {subtitle}
        </p>
      )}

      {goal && (() => {
        const pctOfPace = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
        const delta = goal.current - goal.target;
        const ahead = delta >= 0;
        return (
          <div>
            <div
              style={{
                background: "#F5F5F7",
                borderRadius: "var(--radius-pill)",
                height: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  borderRadius: "var(--radius-pill)",
                  background: met ? "#10B981" : colour,
                  transition: "width 0.4s var(--ease-apple)",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "4px",
              }}
            >
              <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>
                {goal.current} / {goal.target} · {pctOfPace.toFixed(0)}%
              </span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 500,
                  color: ahead ? "#059669" : "#DC2626",
                }}
              >
                {ahead ? "↑" : "↓"} {Math.abs(delta)} {ahead ? "ahead" : "behind"}
              </span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function FunnelPage() {
  const defaults = getDefaultRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);

  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [contacts, setContacts] = useState<number | null>(null);
  const [conversionActions, setConversionActions] = useState<ConversionAction[]>([]);
  const [homeVisits, setHomeVisits] = useState<number | null>(null);
  const [wonJobs, setWonJobs] = useState<number | null>(null);
  const [wonValue, setWonValue] = useState<number | null>(null);
  const [pipelineCount, setPipelineCount] = useState<number | null>(null);
  const [pipelineValue, setPipelineValue] = useState<number | null>(null);
  const [previousPeriod, setPreviousPeriod] = useState<PreviousPeriod | null>(null);
  const [loading, setLoading] = useState(false);

  /* ── Load goals once ── */
  useEffect(() => {
    fetch("/api/goals")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setGoals({ ...DEFAULT_GOALS, ...data });
      })
      .catch(() => {});
  }, []);

  /* ── Pipeline is not date-filtered (live stage count) ── */
  useEffect(() => {
    fetch("/api/hubspot/pipeline-value")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.count != null) setPipelineCount(data.count);
        if (data?.value != null) setPipelineValue(data.value);
        else if (data?.totalValue != null) setPipelineValue(data.totalValue);
      })
      .catch(() => {});
  }, []);

  /* ── Reload everything else when range changes ── */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const contactsP = fetch(`/api/hubspot/contacts-created?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setContacts(d?.total ?? null); })
      .catch(() => { if (!cancelled) setContacts(null); });

    const actionsP = fetch(`/api/hubspot/conversion-actions?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setConversionActions(d?.actions ?? []); })
      .catch(() => { if (!cancelled) setConversionActions([]); });

    const visitsP = fetch(`/api/hubspot/home-visits?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setHomeVisits(d?.total ?? null); })
      .catch(() => { if (!cancelled) setHomeVisits(null); });

    const wonP = fetch(`/api/hubspot/won-deals?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setWonJobs(d?.total ?? null);
        setWonValue(d?.totalValue ?? null);
      })
      .catch(() => {
        if (!cancelled) { setWonJobs(null); setWonValue(null); }
      });

    const prevP = fetch(`/api/hubspot/previous-period?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setPreviousPeriod(d ?? null); })
      .catch(() => { if (!cancelled) setPreviousPeriod(null); });

    Promise.all([contactsP, actionsP, visitsP, wonP, prevP]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [from, to]);

  /* ── Derived totals ── */
  const prospectsTotal = useMemo(
    () => conversionActions.filter((a) => PROSPECT_ACTIONS.includes(a.value)).reduce((s, a) => s + a.count, 0),
    [conversionActions]
  );
  const leadsTotal = useMemo(
    () => conversionActions.filter((a) => LEAD_ACTIONS.includes(a.value)).reduce((s, a) => s + a.count, 0),
    [conversionActions]
  );

  /* ── Pro-rate monthly goals to the selected range ── */
  function proratedGoal(monthlyGoal: number | null): number | null {
    if (!monthlyGoal || monthlyGoal <= 0) return null;
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59");
    const rangeDays = Math.max(
      1,
      Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
    return Math.max(1, Math.round((monthlyGoal / 30.44) * rangeDays));
  }

  /* ── Quick-range presets (matches automation-map pattern) ── */
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const threeMonthsStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const ranges = [
    { label: "This Month", from: fmtDate(monthStart), to: fmtDate(today) },
    { label: "Last Month", from: fmtDate(lastMonthStart), to: fmtDate(lastMonthEnd) },
    { label: "Last 3 Months", from: fmtDate(threeMonthsStart), to: fmtDate(lastMonthEnd) },
  ];

  const prevLabel = previousPeriod
    ? (() => {
        const f = (s: string) => {
          const [, m, d] = s.split("-");
          return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
        };
        return `vs ${f(previousPeriod.from)}–${f(previousPeriod.to)}`;
      })()
    : null;

  const contactsGoal = proratedGoal(goals.contactsGoalPerMonth);
  const prospectsGoal = proratedGoal(goals.prospectsGoalPerMonth);
  const leadsGoal = proratedGoal(goals.leadGoalPerMonth);
  const visitsGoal = proratedGoal(goals.visitsGoalPerMonth);
  const installsGoal = proratedGoal(goals.installsGoalPerMonth);

  return (
    <div style={{ padding: "28px 28px 48px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 22,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--color-text-primary)",
            }}
          >
            Customer Funnel
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
            Contacts, prospects, leads, home visits and won jobs across the whole business.
            {prevLabel && (
              <span style={{ marginLeft: 8, color: "var(--color-text-tertiary)" }}>{prevLabel}</span>
            )}
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
              const active = from === r.from && to === r.to;
              return (
                <button
                  key={r.label}
                  onClick={() => { setFrom(r.from); setTo(r.to); }}
                  style={{
                    fontSize: "11px",
                    fontWeight: active ? 600 : 400,
                    color: active ? "white" : "var(--color-text-secondary)",
                    background: active ? "var(--color-accent)" : "transparent",
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
              borderRadius: "var(--radius-card)",
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
                color: "var(--color-text-primary)",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <span style={{ color: "var(--color-text-tertiary)", fontSize: "12px" }}>→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                fontSize: "12px",
                color: "var(--color-text-primary)",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>
      </div>

      {/* Loading hint */}
      {loading && (
        <div
          style={{
            fontSize: 11,
            color: "var(--color-text-tertiary)",
            marginBottom: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Loading funnel data…
        </div>
      )}

      {/* KPI grid — top of funnel, whole business */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <KpiCard
          label="Contacts"
          value={contacts}
          colour="#6366F1"
          subtitle="New this period"
          comparison={
            previousPeriod && contacts != null
              ? { current: contacts, previous: previousPeriod.contacts }
              : undefined
          }
          goal={
            contactsGoal && contacts != null
              ? { current: contacts, target: contactsGoal }
              : undefined
          }
        />

        <KpiCard
          label="Prospects"
          value={prospectsTotal}
          colour="#F59E0B"
          subtitle="Low-intent enquiries"
          comparison={
            previousPeriod
              ? { current: prospectsTotal, previous: previousPeriod.prospects }
              : undefined
          }
          goal={prospectsGoal ? { current: prospectsTotal, target: prospectsGoal } : undefined}
        />

        <KpiCard
          label="Leads"
          value={leadsTotal}
          colour="#0071E3"
          subtitle="High-intent enquiries"
          comparison={
            previousPeriod
              ? { current: leadsTotal, previous: previousPeriod.leads }
              : undefined
          }
          goal={leadsGoal ? { current: leadsTotal, target: leadsGoal } : undefined}
        />

        <KpiCard
          label="Home Visits"
          value={homeVisits}
          colour="#10B981"
          subtitle={
            goals.siteVisitsGoalPerWeek
              ? `Weekly goal: ${goals.siteVisitsGoalPerWeek}`
              : "Visits booked this period"
          }
          comparison={
            previousPeriod && homeVisits != null
              ? { current: homeVisits, previous: previousPeriod.homeVisits }
              : undefined
          }
          goal={
            visitsGoal && homeVisits != null
              ? { current: homeVisits, target: visitsGoal }
              : undefined
          }
        />

        <KpiCard
          label="Won Jobs"
          value={wonJobs}
          colour="#059669"
          subtitle={
            installsGoal
              ? `Installs target: ${installsGoal} (pro-rata)`
              : "Closed / won this period"
          }
          comparison={
            previousPeriod && wonJobs != null
              ? { current: wonJobs, previous: previousPeriod.wonJobs }
              : undefined
          }
          goal={
            installsGoal && wonJobs != null
              ? { current: wonJobs, target: installsGoal }
              : undefined
          }
        />

        <KpiCard
          label="Won Value"
          value={wonValue}
          displayValue={gbp(wonValue)}
          colour="#8B5CF6"
          subtitle="Revenue booked this period"
          comparison={
            previousPeriod && wonValue != null
              ? { current: Math.round(wonValue), previous: Math.round(previousPeriod.wonValue) }
              : undefined
          }
        />

        <KpiCard
          label="Pipeline"
          value={pipelineCount}
          colour="#D97706"
          subtitle={
            pipelineValue != null
              ? `Open value: ${gbp(pipelineValue)}`
              : "Open deals right now"
          }
        />
      </div>

      {/* Footnote */}
      <p
        style={{
          marginTop: 22,
          fontSize: 11,
          color: "var(--color-text-tertiary)",
        }}
      >
        Goals are monthly targets pro-rated across the selected range. For a per-team breakdown,
        see <a href="/teams" style={{ color: "var(--color-accent)", textDecoration: "none" }}>/teams</a>.
      </p>
    </div>
  );
}
