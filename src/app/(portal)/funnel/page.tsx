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

const PROSPECT_ACTIONS: Record<string, string> = {
  "Brochure Download Form": "Brochure Download",
  "Flipbook Form": "Flipbook Form",
  "VAT Exempt Checker": "VAT Exemption Checker",
  "Pricing Guide": "Pricing Guide",
  "Physical Brochure Request": "Physical Brochure Request",
  "Newsletter Sign Up": "Newsletter",
};
const LEAD_ACTIONS: Record<string, string> = {
  "Brochure - Call Me": "Brochure - Call Me",
  "Request A Callback Form": "Callback Form",
  "Contact Form": "Contact Form",
  "Free Home Design Form": "Home Design Form",
  "Phone Call": "Phone Call",
  "Walk In Bath Form": "Walk In Bath Form",
  "Direct Email": "Direct Email",
  "Brochure - Home Visit": "Brochure - Home Visit",
  "Pricing Guide Home Visit": "Pricing Guide Home Visit",
};

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
  const [wonBySource, setWonBySource] = useState<
    { label: string; count: number; value: number }[]
  >([]);
  const [pipelineCount, setPipelineCount] = useState<number | null>(null);
  const [pipelineValue, setPipelineValue] = useState<number | null>(null);
  const [previousPeriod, setPreviousPeriod] = useState<PreviousPeriod | null>(null);
  const [organicLeads, setOrganicLeads] = useState<number>(0);
  const [homeVisitBreakdown, setHomeVisitBreakdown] = useState<{
    total: number;
    byAction: { value: string; label: string; count: number }[];
    bySource: { value: string; label: string; count: number }[];
  } | null>(null);
  const [prospectToLead, setProspectToLead] = useState<{
    totalEverProspect: number;
    convertedToLead: number;
    rate: number | null;
  } | null>(null);
  const [funnelTiming, setFunnelTiming] = useState<{
    prospectToLead: { avgDays: number | null; sample: number };
    leadToVisit: { avgDays: number | null; sample: number };
    prospectToVisit: { avgDays: number | null; sample: number };
  } | null>(null);
  const [funnelBySource, setFunnelBySource] = useState<{
    sources: {
      value: string;
      label: string;
      contacts: number;
      prospects: number;
      formLeads: number;
      directBookings: number;
      homeVisits: number;
      wonJobs: number;
      prospectActions: { value: string; count: number }[];
      leadActions: { value: string; count: number }[];
    }[];
  } | null>(null);
  const [dowConversion, setDowConversion] = useState<{
    contacts: number[];
    withVisit: number[];
    bySource?: { value: string; label: string; contacts: number[]; withVisit: number[]; totalContacts: number }[];
    byAction?: { value: string; label: string; contacts: number[]; withVisit: number[]; totalContacts: number }[];
  } | null>(null);
  const [dowSegment, setDowSegment] = useState<string>("__all__");
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
        setWonBySource(d?.bySource ?? []);
      })
      .catch(() => {
        if (!cancelled) { setWonJobs(null); setWonValue(null); setWonBySource([]); }
      });

    const prevP = fetch(`/api/hubspot/previous-period?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setPreviousPeriod(d ?? null); })
      .catch(() => { if (!cancelled) setPreviousPeriod(null); });

    const organicP = fetch(`/api/hubspot/organic-leads?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setOrganicLeads(d?.total ?? 0); })
      .catch(() => { if (!cancelled) setOrganicLeads(0); });

    const hvBreakdownP = fetch(`/api/hubspot/home-visit-breakdown?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setHomeVisitBreakdown(d ?? null); })
      .catch(() => { if (!cancelled) setHomeVisitBreakdown(null); });

    const p2lP = fetch(`/api/hubspot/prospect-to-lead?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setProspectToLead(d ?? null); })
      .catch(() => { if (!cancelled) setProspectToLead(null); });

    const timingP = fetch(`/api/hubspot/funnel-timing?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setFunnelTiming(d ?? null); })
      .catch(() => { if (!cancelled) setFunnelTiming(null); });

    const bySourceP = fetch(`/api/hubspot/funnel-by-source?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setFunnelBySource(d ?? null); })
      .catch(() => { if (!cancelled) setFunnelBySource(null); });

    const dowP = fetch(`/api/hubspot/dow-conversion?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setDowConversion(d ?? null);
        setDowSegment("__all__");
      })
      .catch(() => { if (!cancelled) setDowConversion(null); });

    Promise.all([
      contactsP, actionsP, visitsP, wonP, prevP,
      organicP, hvBreakdownP, p2lP, timingP, bySourceP, dowP,
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [from, to]);

  /* ── Derived totals ── */
  const prospects = useMemo(
    () => conversionActions.filter((a) => a.value in PROSPECT_ACTIONS && a.count > 0),
    [conversionActions]
  );
  const prospectsTotal = useMemo(
    () => prospects.reduce((s, a) => s + a.count, 0),
    [prospects]
  );
  const leads = useMemo(
    () => conversionActions.filter((a) => a.value in LEAD_ACTIONS && a.count > 0),
    [conversionActions]
  );
  const formLeadsTotal = useMemo(
    () => leads.reduce((s, a) => s + a.count, 0),
    [leads]
  );
  const leadsTotal = formLeadsTotal + organicLeads;

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

      {/* ── Funnel Breakdown ───────────────────────────────────── */}
      <div style={{ marginTop: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "10px",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
            <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#86868B", margin: 0 }}>
              Funnel Breakdown
            </h2>
            {prevLabel && (
              <span style={{ fontSize: "10px", color: "#AEAEB2", fontWeight: 600 }}>
                {prevLabel}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {(() => {
              const pp = previousPeriod;
              const prevContactRate = pp && pp.contacts > 0 ? (pp.prospects / pp.contacts) * 100 : null;
              const prevLeadRate = pp && pp.contacts > 0 ? (pp.leads / pp.contacts) * 100 : null;
              const prevVisitRate = pp && pp.leads > 0 ? (pp.homeVisits / pp.leads) * 100 : null;
              const prevWonRate = pp && pp.homeVisits > 0 ? (pp.wonJobs / pp.homeVisits) * 100 : null;
              const c = contacts ?? 0;
              const hv = homeVisits ?? 0;
              const wj = wonJobs ?? 0;
              return [
                { label: "Contact → Prospect", rate: c > 0 ? (prospectsTotal / c) * 100 : 0, prev: prevContactRate },
                { label: "Contact → Lead", rate: c > 0 ? (leadsTotal / c) * 100 : 0, prev: prevLeadRate },
                { label: "Lead → Visit", rate: leadsTotal > 0 ? (hv / leadsTotal) * 100 : 0, prev: prevVisitRate },
                { label: "Visit → Won", rate: hv > 0 ? (wj / hv) * 100 : 0, prev: prevWonRate },
              ];
            })().map((c) => {
              const delta = c.prev != null ? c.rate - c.prev : null;
              const better = delta != null && delta >= 0;
              return (
                <span
                  key={c.label}
                  style={{ fontSize: "11px", color: "#86868B", display: "inline-flex", alignItems: "baseline", gap: "5px" }}
                >
                  {c.label} <strong style={{ color: "#1D1D1F" }}>{c.rate.toFixed(1)}%</strong>
                  {delta != null && (
                    <span style={{ fontSize: "10px", fontWeight: 600, color: better ? "#059669" : "#DC2626" }}>
                      {better ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}pp
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {funnelTiming && (() => {
          const fmt = (avg: number | null, sample: number) =>
            avg == null ? (
              <span style={{ color: "#D2D2D7" }}>—</span>
            ) : (
              <>
                <strong style={{ color: "#1D1D1F" }}>{avg.toFixed(1)} days</strong>
                <span style={{ color: "#AEAEB2", marginLeft: "3px" }}>(n={sample})</span>
              </>
            );
          return (
            <div
              style={{
                background: "#FAFAFA",
                border: "none",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                borderRadius: "8px",
                padding: "8px 14px",
                marginBottom: "10px",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "10px", fontWeight: 600, color: "#86868B" }}>
                Avg time in funnel
              </span>
              <span style={{ fontSize: "11px", color: "#86868B" }}>
                Prospect → Lead {fmt(funnelTiming.prospectToLead.avgDays, funnelTiming.prospectToLead.sample)}
              </span>
              <span style={{ color: "#D2D2D7", fontSize: "11px" }}>·</span>
              <span style={{ fontSize: "11px", color: "#86868B" }}>
                Lead → Visit {fmt(funnelTiming.leadToVisit.avgDays, funnelTiming.leadToVisit.sample)}
              </span>
              <span style={{ color: "#D2D2D7", fontSize: "11px" }}>·</span>
              <span style={{ fontSize: "11px", color: "#86868B" }}>
                Prospect → Visit {fmt(funnelTiming.prospectToVisit.avgDays, funnelTiming.prospectToVisit.sample)}
              </span>
            </div>
          );
        })()}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr auto 1fr auto 1fr",
            gap: "0",
            alignItems: "stretch",
          }}
        >
          <FunnelCard
            title="Prospects"
            subtitle="Browsing, not ready to talk"
            total={prospectsTotal}
            colour="#F59E0B"
            bg="#FFFBEB"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            rate={contacts && contacts > 0 ? `${((prospectsTotal / contacts) * 100).toFixed(1)}% of contacts` : undefined}
            comparison={
              previousPeriod ? { current: prospectsTotal, previous: previousPeriod.prospects } : undefined
            }
          >
            {prospects.slice().sort((a, b) => b.count - a.count).map((action) => (
              <MiniRow
                key={action.value}
                label={PROSPECT_ACTIONS[action.value] ?? action.value}
                count={action.count}
              />
            ))}
            {funnelBySource && (() => {
              const bySource = funnelBySource.sources
                .filter((s) => s.prospects > 0)
                .map((s) => ({ label: s.label, count: s.prospects }))
                .sort((a, b) => b.count - a.count);
              if (bySource.length === 0) return null;
              return (
                <>
                  <div style={{ fontSize: "8px", fontWeight: 600, color: "#F59E0B", margin: "10px 0 4px" }}>
                    Original Lead Source
                  </div>
                  {bySource.map((s) => (
                    <MiniRow key={`psrc-${s.label}`} label={s.label} count={s.count} />
                  ))}
                </>
              );
            })()}
          </FunnelCard>

          <ConversionArrow
            rate={(() => {
              if (prospectToLead?.rate != null) return prospectToLead.rate.toFixed(1);
              return "—";
            })()}
            label="Prospect → Lead"
          />

          <FunnelCard
            title="Leads"
            subtitle="Want to talk"
            total={leadsTotal}
            colour="#0071E3"
            bg="#EFF6FF"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"
                  stroke="#0071E3"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            rate={contacts && contacts > 0 ? `${((leadsTotal / contacts) * 100).toFixed(1)}% of contacts` : undefined}
            comparison={
              previousPeriod ? { current: leadsTotal, previous: previousPeriod.leads } : undefined
            }
          >
            {leads.slice().sort((a, b) => b.count - a.count).map((action) => (
              <MiniRow
                key={action.value}
                label={LEAD_ACTIONS[action.value] ?? action.value}
                count={action.count}
              />
            ))}
            {organicLeads > 0 && (
              <>
                <div style={{ borderTop: "1px dashed #CBD5E1", margin: "6px 0", position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      top: "-7px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "#EFF6FF",
                      padding: "0 6px",
                      fontSize: "8px",
                      fontWeight: 600,
                      color: "#0071E3",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Organic
                  </span>
                </div>
                <MiniRow label="Direct bookings (no lead form)" count={organicLeads} highlight />
              </>
            )}
            {funnelBySource && (() => {
              const bySource = funnelBySource.sources
                .filter((s) => s.formLeads + s.directBookings > 0)
                .map((s) => ({ label: s.label, count: s.formLeads + s.directBookings }))
                .sort((a, b) => b.count - a.count);
              if (bySource.length === 0) return null;
              return (
                <>
                  <div style={{ fontSize: "8px", fontWeight: 600, color: "#0071E3", margin: "10px 0 4px" }}>
                    Original Lead Source
                  </div>
                  {bySource.map((s) => (
                    <MiniRow key={`lsrc-${s.label}`} label={s.label} count={s.count} />
                  ))}
                </>
              );
            })()}
          </FunnelCard>

          <ConversionArrow
            rate={leadsTotal > 0 ? (((homeVisits ?? 0) / leadsTotal) * 100).toFixed(1) : "0"}
            label="Lead → Visit"
            secondaryRate={contacts && contacts > 0 ? (((homeVisits ?? 0) / contacts) * 100).toFixed(1) : "0"}
            secondaryLabel="Contact → Visit"
          />

          <FunnelCard
            title="Home Visits"
            subtitle="Visit booked"
            total={homeVisits ?? 0}
            colour="#10B981"
            bg="#ECFDF5"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 22V12h6v10" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            rate={leadsTotal > 0 ? `Lead → Visit ${(((homeVisits ?? 0) / leadsTotal) * 100).toFixed(1)}%` : undefined}
            comparison={
              previousPeriod && homeVisits != null
                ? { current: homeVisits, previous: previousPeriod.homeVisits }
                : undefined
            }
          >
            {homeVisitBreakdown && homeVisitBreakdown.total > 0 ? (
              <>
                {homeVisitBreakdown.byAction.length > 0 && (
                  <>
                    <div style={{ fontSize: "8px", fontWeight: 600, color: "#10B981", margin: "2px 0 4px" }}>
                      Conversion Action
                    </div>
                    {homeVisitBreakdown.byAction.map((a) => (
                      <MiniRow key={`act-${a.value}`} label={a.label} count={a.count} />
                    ))}
                  </>
                )}
                {homeVisitBreakdown.bySource.length > 0 && (
                  <>
                    <div style={{ fontSize: "8px", fontWeight: 600, color: "#10B981", margin: "10px 0 4px" }}>
                      Original Lead Source
                    </div>
                    {homeVisitBreakdown.bySource.map((s) => (
                      <MiniRow key={`src-${s.value}`} label={s.label} count={s.count} />
                    ))}
                  </>
                )}
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 0" }}>
                <span style={{ fontSize: "32px", fontWeight: 600, color: "#059669", lineHeight: 1 }}>
                  {(homeVisits ?? 0).toLocaleString()}
                </span>
              </div>
            )}
          </FunnelCard>

          <ConversionArrow
            rate={homeVisits && homeVisits > 0 ? (((wonJobs ?? 0) / homeVisits) * 100).toFixed(1) : "0"}
            label="Visit → Won"
          />

          <FunnelCard
            title="Won Jobs"
            subtitle="Deal won"
            total={wonJobs ?? 0}
            colour="#059669"
            bg="#ECFDF5"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  stroke="#059669"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            rate={
              homeVisits && homeVisits > 0
                ? `${(((wonJobs ?? 0) / homeVisits) * 100).toFixed(1)}% of visits`
                : undefined
            }
            comparison={
              previousPeriod && wonJobs != null
                ? { current: wonJobs, previous: previousPeriod.wonJobs }
                : undefined
            }
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 0",
                gap: "2px",
              }}
            >
              <span style={{ fontSize: "32px", fontWeight: 600, color: "#059669", lineHeight: 1 }}>
                {(wonJobs ?? 0).toLocaleString()}
              </span>
              {wonValue !== null && wonValue > 0 && (
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#047857" }}>
                  £{wonValue.toLocaleString()}
                </span>
              )}
            </div>
            {wonBySource.length > 0 && (
              <>
                <div style={{ fontSize: "8px", fontWeight: 600, color: "#059669", margin: "10px 0 4px" }}>
                  Original Lead Source
                </div>
                {wonBySource.map((s) => (
                  <MiniRow
                    key={`wsrc-${s.label}`}
                    label={`${s.label}${s.value > 0 ? ` (£${s.value.toLocaleString()})` : ""}`}
                    count={s.count}
                  />
                ))}
              </>
            )}
          </FunnelCard>
        </div>
      </div>

      {/* ── Visit Conversion by Day ────────────────────────────── */}
      {dowConversion && dowConversion.contacts.some((c) => c > 0) && (() => {
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const sourceList = dowConversion.bySource ?? [];
        const actionList = dowConversion.byAction ?? [];
        let segContacts: number[];
        let segVisits: number[];
        let segLabel = "All contacts";
        if (dowSegment.startsWith("source:")) {
          const value = dowSegment.slice("source:".length);
          const seg = sourceList.find((s) => s.value === value);
          if (seg) {
            segContacts = seg.contacts;
            segVisits = seg.withVisit;
            segLabel = seg.label;
          } else {
            segContacts = dowConversion.contacts;
            segVisits = dowConversion.withVisit;
          }
        } else if (dowSegment.startsWith("action:")) {
          const value = dowSegment.slice("action:".length);
          const seg = actionList.find((a) => a.value === value);
          if (seg) {
            segContacts = seg.contacts;
            segVisits = seg.withVisit;
            segLabel = seg.label;
          } else {
            segContacts = dowConversion.contacts;
            segVisits = dowConversion.withVisit;
          }
        } else {
          segContacts = dowConversion.contacts;
          segVisits = dowConversion.withVisit;
        }

        const rates = segContacts.map((c, i) => (c > 0 ? (segVisits[i] / c) * 100 : 0));
        const maxRate = Math.max(...rates, 1);
        const bestIdx = rates.indexOf(Math.max(...rates));
        const wdContacts = segContacts.slice(0, 5).reduce((a, b) => a + b, 0);
        const wdVisits = segVisits.slice(0, 5).reduce((a, b) => a + b, 0);
        const weContacts = segContacts.slice(5).reduce((a, b) => a + b, 0);
        const weVisits = segVisits.slice(5).reduce((a, b) => a + b, 0);
        const wdRate = wdContacts > 0 ? (wdVisits / wdContacts) * 100 : 0;
        const weRate = weContacts > 0 ? (weVisits / weContacts) * 100 : 0;

        return (
          <div
            style={{
              marginTop: 24,
              background: "white",
              borderRadius: "18px",
              border: "none",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              minHeight: "240px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "#86868B", margin: 0 }}>
                Visit Conversion by Day
              </p>
              <span style={{ fontSize: "10px", color: "#AEAEB2", fontWeight: 600 }}>
                % that book a visit
              </span>
            </div>
            <p style={{ fontSize: "11px", color: "#86868B", margin: "0 0 10px", lineHeight: 1.4 }}>
              Showing <strong style={{ color: "#1D1D1F" }}>{segLabel}</strong>. The percentage of contacts entering on each day who go on to book a home visit.
            </p>

            {(sourceList.length > 0 || actionList.length > 0) && (
              <select
                value={dowSegment}
                onChange={(e) => setDowSegment(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: "12px",
                  color: "#1D1D1F",
                  background: "#FAFAFA",
                  border: "none",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                  borderRadius: "8px",
                  marginBottom: "10px",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="__all__">
                  All contacts ({dowConversion.contacts.reduce((a, b) => a + b, 0)})
                </option>
                {sourceList.length > 0 && (
                  <optgroup label="By original lead source">
                    {sourceList.filter((s) => s.totalContacts > 0).map((s) => (
                      <option key={`source:${s.value}`} value={`source:${s.value}`}>
                        {s.label} ({s.totalContacts})
                      </option>
                    ))}
                  </optgroup>
                )}
                {actionList.length > 0 && (
                  <optgroup label="By conversion action">
                    {actionList.filter((a) => a.totalContacts > 0).map((a) => (
                      <option key={`action:${a.value}`} value={`action:${a.value}`}>
                        {a.label} ({a.totalContacts})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
              <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "8px", padding: "8px 10px" }}>
                <p style={{ fontSize: "10px", color: "#047857", margin: 0, fontWeight: 600 }}>Weekday</p>
                <p style={{ fontSize: "20px", fontWeight: 600, color: "#059669", margin: "2px 0 0", lineHeight: 1.1 }}>
                  {wdRate.toFixed(1)}%
                </p>
                <p style={{ fontSize: "10px", color: "#86868B", margin: "2px 0 0" }}>
                  {wdVisits} of {wdContacts}
                </p>
              </div>
              <div
                style={{
                  background: weRate < wdRate ? "#FEF2F2" : "#ECFDF5",
                  border: `1px solid ${weRate < wdRate ? "#FECACA" : "#A7F3D0"}`,
                  borderRadius: "8px",
                  padding: "8px 10px",
                }}
              >
                <p style={{ fontSize: "10px", color: weRate < wdRate ? "#B91C1C" : "#047857", margin: 0, fontWeight: 600 }}>
                  Weekend
                </p>
                <p
                  style={{
                    fontSize: "20px",
                    fontWeight: 600,
                    color: weRate < wdRate ? "#DC2626" : "#059669",
                    margin: "2px 0 0",
                    lineHeight: 1.1,
                  }}
                >
                  {weRate.toFixed(1)}%
                </p>
                <p style={{ fontSize: "10px", color: "#86868B", margin: "2px 0 0" }}>
                  {weVisits} of {weContacts}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", flex: 1, minHeight: 0 }}>
              {days.map((day, i) => {
                const isWeekend = i >= 5;
                const isBest = i === bestIdx;
                const colour = isBest ? "#10B981" : isWeekend ? "#F59E0B" : "#6366F1";
                return (
                  <div
                    key={day}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                      height: "100%",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        flex: 1,
                        minHeight: 0,
                      }}
                    >
                      {segContacts[i] > 0 && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            color: isBest ? "#059669" : "#0F172A",
                            marginBottom: "2px",
                          }}
                        >
                          {rates[i].toFixed(0)}%
                        </span>
                      )}
                      <div
                        title={`${segVisits[i]} of ${segContacts[i]} contacts booked a visit`}
                        style={{
                          width: "100%",
                          maxWidth: "48px",
                          height: `${Math.max((rates[i] / maxRate) * 100, rates[i] > 0 ? 4 : 0)}%`,
                          background: colour,
                          borderRadius: "4px 4px 0 0",
                          transition: "height 0.3s ease",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        color: isBest ? "#059669" : isWeekend ? "#B45309" : "#64748B",
                      }}
                    >
                      {day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

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

/* ── Funnel Breakdown helper components (ported from /overview) ── */

function ConversionArrow({
  rate,
  label,
  secondaryRate,
  secondaryLabel,
}: {
  rate: string;
  label: string;
  secondaryRate?: string;
  secondaryLabel?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 4px",
        minWidth: "44px",
      }}
    >
      <span style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F", lineHeight: 1 }}>
        {rate}%
      </span>
      <svg width="24" height="16" viewBox="0 0 24 16" style={{ margin: "4px 0" }}>
        <path
          d="M4 8 L16 8 M12 3 L18 8 L12 13"
          stroke="#94A3B8"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        style={{
          fontSize: "9px",
          color: "#AEAEB2",
          textTransform: "uppercase",
          letterSpacing: "0.3px",
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>
      {secondaryRate !== undefined && secondaryLabel && (
        <div
          style={{
            marginTop: "10px",
            paddingTop: "8px",
            borderTop: "1px solid rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1D1D1F", lineHeight: 1 }}>
            {secondaryRate}%
          </span>
          <span
            style={{
              fontSize: "9px",
              color: "#AEAEB2",
              textTransform: "uppercase",
              letterSpacing: "0.3px",
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            {secondaryLabel}
          </span>
        </div>
      )}
    </div>
  );
}

function FunnelCard({
  title,
  subtitle,
  total,
  bg,
  icon,
  rate,
  comparison,
  children,
}: {
  title: string;
  subtitle: string;
  total: number;
  colour: string;
  bg: string;
  icon: React.ReactNode;
  rate?: string;
  comparison?: { current: number; previous: number };
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "20px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        overflow: "hidden",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F", margin: 0 }}>{title}</p>
          <p style={{ fontSize: "10px", color: "#AEAEB2", margin: "1px 0 0" }}>{subtitle}</p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span
          style={{
            fontSize: "28px",
            fontWeight: 600,
            color: "#1D1D1F",
            lineHeight: 1,
            letterSpacing: "-0.5px",
          }}
        >
          {total.toLocaleString()}
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

      {rate && <p style={{ fontSize: "11px", color: "#86868B", margin: 0 }}>{rate}</p>}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "3px",
          borderTop: "1px solid rgba(0,0,0,0.04)",
          paddingTop: "10px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function MiniRow({
  label,
  count,
  highlight,
}: {
  label: string;
  count: number;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: highlight ? "#DBEAFE" : "transparent",
        borderRadius: highlight ? "6px" : 0,
        padding: highlight ? "4px 8px" : 0,
      }}
    >
      <span style={{ fontSize: "12px", color: highlight ? "#1D4ED8" : "#334155", fontWeight: highlight ? 600 : 400 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: highlight ? "#1D4ED8" : "#0F172A",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {count.toLocaleString()}
      </span>
    </div>
  );
}
