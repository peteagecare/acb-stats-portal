"use client";

import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";

interface LeadSource {
  label: string;
  value: string;
  count: number;
}

interface Goals {
  leadGoalPerMonth: number | null;
  visitsGoalPerMonth: number | null;
  ppcPercentGoal: number | null;
  seoPercentGoal: number | null;
  contentPercentGoal: number | null;
}

const DEFAULT_GOALS: Goals = {
  leadGoalPerMonth: null,
  visitsGoalPerMonth: null,
  ppcPercentGoal: null,
  seoPercentGoal: null,
  contentPercentGoal: null,
};

async function loadGoalsFromServer(): Promise<Goals> {
  try {
    const res = await fetch("/api/goals");
    if (res.ok) return { ...DEFAULT_GOALS, ...(await res.json()) };
  } catch {}
  return DEFAULT_GOALS;
}

async function saveGoalsToServer(goals: Goals) {
  await fetch("/api/goals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(goals),
  });
}

/* ── Constants ── */

const SOURCE_CATEGORIES: Record<string, string> = {
  "Google Ads": "PPC",
  "Bing Ads": "PPC",
  "Facebook Ads": "PPC",
  "Organic Search": "SEO",
  "AI": "SEO",
  "Directory Referral": "SEO",
  "Organic Social": "Content",
  "Organic YouTube": "Content",
};

function getSourceCategory(value: string): string {
  return SOURCE_CATEGORIES[value] ?? "Other";
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

/* ── Settings Modal ── */

function parseGoalDraft(val: string): number | null {
  const n = val.trim() === "" ? null : parseInt(val, 10);
  return n !== null && !isNaN(n) && n > 0 ? n : null;
}

function SettingsModal({ onClose, initialGoals }: { onClose: () => void; initialGoals: Goals }) {
  const [draftLead, setDraftLead] = useState(initialGoals.leadGoalPerMonth !== null ? String(initialGoals.leadGoalPerMonth) : "");
  const [draftVisitsMonth, setDraftVisitsMonth] = useState(initialGoals.visitsGoalPerMonth !== null ? String(initialGoals.visitsGoalPerMonth) : "");
  const [draftPpc, setDraftPpc] = useState(initialGoals.ppcPercentGoal !== null ? String(initialGoals.ppcPercentGoal) : "");
  const [draftSeo, setDraftSeo] = useState(initialGoals.seoPercentGoal !== null ? String(initialGoals.seoPercentGoal) : "");
  const [draftContent, setDraftContent] = useState(initialGoals.contentPercentGoal !== null ? String(initialGoals.contentPercentGoal) : "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const updated: Goals = {
      leadGoalPerMonth: parseGoalDraft(draftLead),
      visitsGoalPerMonth: parseGoalDraft(draftVisitsMonth),
      ppcPercentGoal: parseGoalDraft(draftPpc),
      seoPercentGoal: parseGoalDraft(draftSeo),
      contentPercentGoal: parseGoalDraft(draftContent),
    };
    await saveGoalsToServer(updated);
    setSaving(false);
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      />
      <div
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "440px",
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid #F1F5F9",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
            Goals
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "#F1F5F9",
              border: "none",
              cursor: "pointer",
              padding: "6px",
              color: "#64748B",
              fontSize: "16px",
              lineHeight: 1,
              borderRadius: "8px",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label
              htmlFor="leadGoal"
              style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0F172A", marginBottom: "6px" }}
            >
              Lead Goal Per Month
            </label>
            <p style={{ fontSize: "12px", color: "#94A3B8", margin: "0 0 10px" }}>
              Auto-adjusts to your selected date range.
            </p>
            <input
              id="leadGoal"
              type="number"
              min="1"
              placeholder="e.g. 50"
              value={draftLead}
              onChange={(e) => setDraftLead(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "10px 14px",
                fontSize: "14px",
                color: "#0F172A",
                boxSizing: "border-box",
                background: "#F8FAFC",
              }}
            />
          </div>

          <div style={{ borderTop: "1px solid #F1F5F9" }} />

          <div>
            <label
              htmlFor="visitsMonthGoal"
              style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0F172A", marginBottom: "6px" }}
            >
              Site Visits Booked Per Month
            </label>
            <p style={{ fontSize: "12px", color: "#94A3B8", margin: "0 0 10px" }}>
              Auto-adjusts to your selected date range.
            </p>
            <input
              id="visitsMonthGoal"
              type="number"
              min="1"
              placeholder="e.g. 20"
              value={draftVisitsMonth}
              onChange={(e) => setDraftVisitsMonth(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "10px 14px",
                fontSize: "14px",
                color: "#0F172A",
                boxSizing: "border-box",
                background: "#F8FAFC",
              }}
            />
          </div>

          <div style={{ borderTop: "1px solid #F1F5F9" }} />

          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", marginBottom: "6px" }}>
              Source Channel Goals (%)
            </p>
            <p style={{ fontSize: "12px", color: "#94A3B8", margin: "0 0 12px" }}>
              Target percentage of leads + prospects from each channel.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="ppcGoal" style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#EF4444", marginBottom: "4px" }}>PPC %</label>
                <input id="ppcGoal" type="number" min="0" max="100" placeholder="e.g. 60" value={draftPpc} onChange={(e) => setDraftPpc(e.target.value)}
                  style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="seoGoal" style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#10B981", marginBottom: "4px" }}>SEO %</label>
                <input id="seoGoal" type="number" min="0" max="100" placeholder="e.g. 25" value={draftSeo} onChange={(e) => setDraftSeo(e.target.value)}
                  style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="contentGoal" style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#8B5CF6", marginBottom: "4px" }}>Content %</label>
                <input id="contentGoal" type="number" min="0" max="100" placeholder="e.g. 15" value={draftContent} onChange={(e) => setDraftContent(e.target.value)}
                  style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#0F172A", boxSizing: "border-box", background: "#F8FAFC" }} />
              </div>
            </div>
            {(() => {
              const total = (parseGoalDraft(draftPpc) ?? 0) + (parseGoalDraft(draftSeo) ?? 0) + (parseGoalDraft(draftContent) ?? 0);
              if (total > 0) return (
                <p style={{ fontSize: "11px", color: total > 100 ? "#DC2626" : "#94A3B8", margin: "8px 0 0" }}>
                  Total: {total}% {total > 100 ? "(exceeds 100%)" : `(${100 - total}% other)`}
                </p>
              );
              return null;
            })()}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            padding: "16px 24px",
            borderTop: "1px solid #F1F5F9",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "9px 20px",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "10px",
              border: "1px solid #E2E8F0",
              background: "white",
              color: "#64748B",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "9px 20px",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "10px",
              border: "none",
              background: saving ? "#64748B" : "#0F172A",
              color: "white",
              cursor: "pointer",
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function getDefaultDates() {
  const now = new Date();
  const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  return { from, to };
}

/* ── Dashboard ── */

export default function Dashboard() {
  const defaults = getDefaultDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [conversionActions, setConversionActions] = useState<LeadSource[]>([]);
  const [homeVisits, setHomeVisits] = useState<number | null>(null);
  const [timelineData, setTimelineData] = useState<{ label: string; count: number }[]>([]);
  const [timelineGranularity, setTimelineGranularity] = useState<string>("day");
  const [lifecycleStages, setLifecycleStages] = useState<{ label: string; value: string; count: number }[]>([]);
  const [lifecyclePeriod, setLifecyclePeriod] = useState<{ label: string; value: string; count: number }[]>([]);
  const [wonJobs, setWonJobs] = useState<number | null>(null);
  const [wonValue, setWonValue] = useState<number | null>(null);
  const [sourceBreakdown, setSourceBreakdown] = useState<Record<string, { prospects: number; leads: number }>>({});
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);

  useEffect(() => {
    loadGoalsFromServer().then(setGoals);
  }, [showSettings]);

  // Lifecycle stages — live count, not date-filtered
  useEffect(() => {
    fetch("/api/hubspot/lifecycle-stages")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.stages) setLifecycleStages(data.stages); })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadProgress(0);
    setSources([]);
    try {
      const gaRes = await fetch(`/api/ga/active-users?from=${from}&to=${to}`);
      if (gaRes.ok) setActiveUsers((await gaRes.json()).activeUsers);
      setLoadProgress(15);

      // Batch 1: Core data
      const [sourcesRes, actionsRes, visitsRes] = await Promise.all([
        fetch(`/api/hubspot/lead-sources?from=${from}&to=${to}`),
        fetch(`/api/hubspot/conversion-actions?from=${from}&to=${to}`),
        fetch(`/api/hubspot/home-visits?from=${from}&to=${to}`),
      ]);
      if (sourcesRes.ok) setSources((await sourcesRes.json()).sources);
      if (actionsRes.ok) setConversionActions((await actionsRes.json()).actions);
      if (visitsRes.ok) setHomeVisits((await visitsRes.json()).total);
      setLoadProgress(40);

      // Batch 2: Won jobs
      const wonRes = await fetch(`/api/hubspot/won-deals?from=${from}&to=${to}`);
      if (wonRes.ok) {
        const wonData = await wonRes.json();
        setWonJobs(wonData.total);
        setWonValue(wonData.totalValue);
      }
      setLoadProgress(55);

      // Batch 3: Source breakdown
      const breakdownRes = await fetch(`/api/hubspot/source-breakdown?from=${from}&to=${to}`);
      if (breakdownRes.ok) setSourceBreakdown((await breakdownRes.json()).breakdown);
      setLoadProgress(70);

      // Batch 4: Lifecycle period
      const lcPeriodRes = await fetch(`/api/hubspot/lifecycle-stages-period?from=${from}&to=${to}`);
      if (lcPeriodRes.ok) setLifecyclePeriod((await lcPeriodRes.json()).stages);
      setLoadProgress(85);

      // Batch 5: Timeline
      const timelineRes = await fetch(`/api/hubspot/contacts-daily?from=${from}&to=${to}`);
      if (timelineRes.ok) {
        const timelineJson = await timelineRes.json();
        setTimelineData(timelineJson.data);
        setTimelineGranularity(timelineJson.granularity);
      }
      setLoadProgress(100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sourcesTotal = sources.reduce((sum, s) => sum + s.count, 0);
  const ppcSources = sources.filter((s) => getSourceCategory(s.value) === "PPC");
  const seoSources = sources.filter((s) => getSourceCategory(s.value) === "SEO");
  const contentSources = sources.filter((s) => getSourceCategory(s.value) === "Content");
  const otherSources = sources.filter((s) => getSourceCategory(s.value) === "Other");
  const ppcTotal = ppcSources.reduce((sum, s) => sum + s.count, 0);
  const seoTotal = seoSources.reduce((sum, s) => sum + s.count, 0);
  const contentTotal = contentSources.reduce((sum, s) => sum + s.count, 0);
  const otherTotal = otherSources.reduce((sum, s) => sum + s.count, 0);
  const prospects = conversionActions.filter(
    (a) => a.value in PROSPECT_ACTIONS && a.count > 0
  );
  const prospectsTotal = prospects.reduce((sum, a) => sum + a.count, 0);
  const leads = conversionActions.filter(
    (a) => a.value in LEAD_ACTIONS && a.count > 0
  );
  const leadsTotal = leads.reduce((sum, a) => sum + a.count, 0);

  const hasData = sources.length > 0;

  const categoryCards: { title: string; total: number; sources: LeadSource[]; colour: string; bg: string; icon: string }[] = [
    { title: "PPC", total: ppcTotal, sources: ppcSources, colour: "#EF4444", bg: "#FEF2F2", icon: "Paid ads" },
    { title: "SEO", total: seoTotal, sources: seoSources, colour: "#10B981", bg: "#ECFDF5", icon: "Organic search" },
    { title: "Content", total: contentTotal, sources: contentSources, colour: "#8B5CF6", bg: "#F5F3FF", icon: "Social & video" },
    { title: "Other", total: otherTotal, sources: otherSources, colour: "#64748B", bg: "#F8FAFC", icon: "Direct & misc" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9" }}>
      {/* Header */}
      <header style={{ background: "#0F172A", padding: "0 24px" }}>
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: "64px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img src="/acb-logo.png" alt="ACB" style={{ height: "36px", objectFit: "contain" }} />
            <div>
              <h1 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "white", letterSpacing: "-0.3px" }}>
                ACB Stats
              </h1>
              <p style={{ fontSize: "11px", margin: 0, color: "#64748B" }}>Marketing Funnel</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <a
              href="/automations"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#94A3B8",
                textDecoration: "none",
                padding: "8px 14px",
                borderRadius: "10px",
                background: "#1E293B",
              }}
            >
              Automations
            </a>
            {/* Date range inline in header */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#1E293B", borderRadius: "10px", padding: "6px 12px" }}>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#CBD5E1",
                  fontSize: "13px",
                  outline: "none",
                  colorScheme: "dark",
                }}
              />
              <span style={{ color: "#475569", fontSize: "12px" }}>&mdash;</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#CBD5E1",
                  fontSize: "13px",
                  outline: "none",
                  colorScheme: "dark",
                }}
              />
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              style={{
                background: loading ? "#334155" : "#3B82F6",
                color: "white",
                fontWeight: 600,
                borderRadius: "10px",
                padding: "8px 18px",
                fontSize: "13px",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {loading ? "..." : "Go"}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              title="Settings"
              style={{
                background: "#1E293B",
                border: "none",
                borderRadius: "10px",
                padding: "8px",
                cursor: "pointer",
                color: "#94A3B8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16.17 12.5a1.39 1.39 0 00.28 1.53l.05.05a1.69 1.69 0 11-2.38 2.38l-.05-.05a1.39 1.39 0 00-1.53-.28 1.39 1.39 0 00-.84 1.27v.15a1.69 1.69 0 11-3.38 0v-.08a1.39 1.39 0 00-.91-1.27 1.39 1.39 0 00-1.53.28l-.05.05a1.69 1.69 0 11-2.38-2.38l.05-.05a1.39 1.39 0 00.28-1.53 1.39 1.39 0 00-1.27-.84h-.15a1.69 1.69 0 110-3.38h.08a1.39 1.39 0 001.27-.91 1.39 1.39 0 00-.28-1.53l-.05-.05a1.69 1.69 0 112.38-2.38l.05.05a1.39 1.39 0 001.53.28h.07a1.39 1.39 0 00.84-1.27v-.15a1.69 1.69 0 113.38 0v.08a1.39 1.39 0 00.84 1.27 1.39 1.39 0 001.53-.28l.05-.05a1.69 1.69 0 112.38 2.38l-.05.05a1.39 1.39 0 00-.28 1.53v.07a1.39 1.39 0 001.27.84h.15a1.69 1.69 0 110 3.38h-.08a1.39 1.39 0 00-1.27.84z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px" }}>
        {/* Error */}
        {error && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#DC2626",
              borderRadius: "12px",
              padding: "12px 16px",
              marginBottom: "20px",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        {/* Full-screen loader — hides everything until data is ready */}
        {!hasData && (() => {
          const radius = 62;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference - (loadProgress / 100) * circumference;
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2000,
                background: "white",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "24px",
              }}
            >
              {/* Circular progress ring with logo inside */}
              <div style={{ position: "relative", width: "148px", height: "148px" }}>
                <svg width="148" height="148" style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
                  {/* Background ring */}
                  <circle cx="74" cy="74" r={radius} fill="none" stroke="#F1F5F9" strokeWidth="5" />
                  {/* Progress ring */}
                  <circle
                    cx="74" cy="74" r={radius} fill="none"
                    stroke="#3B82F6"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ transition: "stroke-dashoffset 0.4s ease" }}
                  />
                </svg>
                {/* Logo centred inside the ring */}
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img src="/acb-logo.png" alt="Age Care Bathrooms" style={{ height: "60px", objectFit: "contain" }} />
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A", margin: "0 0 4px" }}>
                  {loadProgress}%
                </p>
                <p style={{ fontSize: "13px", color: "#94A3B8", margin: 0 }}>
                  {loadProgress < 15 ? "Connecting..." : loadProgress < 55 ? "Loading contacts..." : loadProgress < 85 ? "Analysing sources..." : "Almost there..."}
                </p>
              </div>
            </div>
          );
        })()}

        {hasData && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* === TOP ROW: Active Users → Contacts === */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr auto 1fr auto 1fr auto 1fr", alignItems: "stretch", gap: "0" }}>
              <KpiCard label="Website Visitors" value={activeUsers} colour="#8B5CF6" subtitle="Google Analytics" />
              <ConversionArrow
                rate={activeUsers && sourcesTotal ? ((sourcesTotal / activeUsers) * 100).toFixed(2) : "0"}
                label="Visitor → Contact"
              />
              <KpiCard label="Contacts" value={sourcesTotal} colour="#6366F1" subtitle="HubSpot CRM" />
              <ConversionArrow
                rate={sourcesTotal > 0 ? ((prospectsTotal / sourcesTotal) * 100).toFixed(1) : "0"}
                label="Contact → Prospect"
              />
              <KpiCard label="Prospects" value={prospectsTotal} colour="#F59E0B" subtitle={sourcesTotal ? `${((prospectsTotal / sourcesTotal) * 100).toFixed(1)}% of contacts` : undefined} />
              <ConversionArrow
                rate={prospectsTotal > 0 ? ((leadsTotal / prospectsTotal) * 100).toFixed(1) : "0"}
                label="Prospect → Lead"
              />
              <KpiCard label="Leads" value={leadsTotal} colour="#3B82F6" subtitle={prospectsTotal ? `${((leadsTotal / prospectsTotal) * 100).toFixed(1)}% of prospects` : undefined} />
              <ConversionArrow
                rate={leadsTotal > 0 ? (((homeVisits ?? 0) / leadsTotal) * 100).toFixed(1) : "0"}
                label="Lead → Visit"
              />
              <KpiCard label="Home Visits" value={homeVisits} colour="#10B981" subtitle={leadsTotal ? `${((homeVisits ?? 0) / leadsTotal * 100).toFixed(1)}% of leads` : undefined} />
              <ConversionArrow
                rate={(homeVisits ?? 0) > 0 ? (((wonJobs ?? 0) / (homeVisits ?? 1)) * 100).toFixed(1) : "0"}
                label="Visit → Won"
              />
              <KpiCard label="Won Jobs" value={wonJobs} colour="#059669" subtitle={wonValue ? `£${wonValue.toLocaleString()} value` : undefined} />
            </div>

            {/* === LIFECYCLE STAGES === */}
            {lifecycleStages.length > 0 && (
              <LifecyclePipeline stages={lifecycleStages} periodStages={lifecyclePeriod} />
            )}

            {/* === CONTACTS OVER TIME === */}
            {timelineData.length > 0 && (
              <div
                style={{
                  background: "white",
                  borderRadius: "14px",
                  border: "1px solid #E2E8F0",
                  padding: "20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Contacts per {timelineGranularity}
                  </p>
                  <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>
                    {timelineData.reduce((s, d) => s + d.count, 0).toLocaleString()} total
                  </p>
                </div>
                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                      <defs>
                        <linearGradient id="contactGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366F1" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#94A3B8" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(d: string) => {
                          if (timelineGranularity === "day") {
                            const [, m, day] = d.split("-");
                            return `${parseInt(day)}/${parseInt(m)}`;
                          }
                          return d;
                        }}
                        interval={timelineData.length > 20 ? Math.floor(timelineData.length / 10) : 0}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#94A3B8" }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        labelFormatter={(d) => String(d)}
                        formatter={(value) => [Number(value).toLocaleString(), "Contacts"]}
                        contentStyle={{ borderRadius: "10px", border: "1px solid #E2E8F0", fontSize: "13px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#6366F1"
                        strokeWidth={2}
                        fill="url(#contactGradient)"
                        dot={timelineData.length <= 31 ? { r: 3, fill: "#6366F1", strokeWidth: 0 } : false}
                        activeDot={{ r: 5, fill: "#6366F1", stroke: "white", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* === GOAL BARS === */}
            {(goals.leadGoalPerMonth || goals.visitsGoalPerMonth) && (
              <div style={{ display: "grid", gridTemplateColumns: goals.leadGoalPerMonth && goals.visitsGoalPerMonth ? "1fr 1fr" : "1fr", gap: "16px" }}>
                {goals.leadGoalPerMonth !== null && goals.leadGoalPerMonth > 0 && (
                  <GoalBar
                    current={leadsTotal}
                    monthlyGoal={goals.leadGoalPerMonth}
                    label="Lead Goal"
                    colour="#3B82F6"
                    from={from}
                    to={to}
                  />
                )}
                {goals.visitsGoalPerMonth !== null && goals.visitsGoalPerMonth > 0 && (
                  <GoalBar
                    current={homeVisits ?? 0}
                    monthlyGoal={goals.visitsGoalPerMonth}
                    label="Visit Goal"
                    colour="#10B981"
                    from={from}
                    to={to}
                  />
                )}
              </div>
            )}

            {/* === CHARTS + CONTACT SOURCES === */}
            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Contact Sources
                </h2>
                <span style={{ fontSize: "13px", color: "#94A3B8" }}>
                  {sourcesTotal.toLocaleString()} total contacts
                </span>
              </div>

              {/* Charts row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px", marginBottom: "16px" }}>
                {/* Donut chart */}
                <div
                  style={{
                    background: "white",
                    borderRadius: "14px",
                    border: "1px solid #E2E8F0",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#64748B", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Source Split
                  </p>
                  <div style={{ width: "100%", height: 200, position: "relative" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "PPC", value: ppcTotal, fill: "#EF4444" },
                            { name: "SEO", value: seoTotal, fill: "#10B981" },
                            { name: "Content", value: contentTotal, fill: "#8B5CF6" },
                            { name: "Other", value: otherTotal, fill: "#94A3B8" },
                          ].filter((d) => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        />
                        <Tooltip
                          formatter={(value, name) => [`${Number(value).toLocaleString()} (${sourcesTotal > 0 ? ((Number(value) / sourcesTotal) * 100).toFixed(1) : 0}%)`, String(name)]}
                          contentStyle={{ borderRadius: "10px", border: "1px solid #E2E8F0", fontSize: "13px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Centre label */}
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        textAlign: "center",
                        pointerEvents: "none",
                      }}
                    >
                      <p style={{ fontSize: "22px", fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1 }}>
                        {sourcesTotal.toLocaleString()}
                      </p>
                      <p style={{ fontSize: "10px", color: "#94A3B8", margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        total
                      </p>
                    </div>
                  </div>
                  {/* Legend */}
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center", marginTop: "8px" }}>
                    {[
                      { name: "PPC", colour: "#EF4444", value: ppcTotal },
                      { name: "SEO", colour: "#10B981", value: seoTotal },
                      { name: "Content", colour: "#8B5CF6", value: contentTotal },
                      { name: "Other", colour: "#94A3B8", value: otherTotal },
                    ].filter((d) => d.value > 0).map((d) => (
                      <div key={d.name} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: d.colour }} />
                        <span style={{ fontSize: "12px", color: "#334155" }}>{d.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Funnel bar chart */}
                <div
                  style={{
                    background: "white",
                    borderRadius: "14px",
                    border: "1px solid #E2E8F0",
                    padding: "20px",
                  }}
                >
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#64748B", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Marketing Funnel
                  </p>
                  <div style={{ width: "100%", height: 230 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          ...(activeUsers !== null ? [{ stage: "Visitors", value: activeUsers, fill: "#8B5CF6" }] : []),
                          { stage: "Contacts", value: sourcesTotal, fill: "#6366F1" },
                          { stage: "Prospects", value: prospectsTotal, fill: "#F59E0B" },
                          { stage: "Leads", value: leadsTotal, fill: "#3B82F6" },
                          { stage: "Home Visits", value: homeVisits ?? 0, fill: "#10B981" },
                        ]}
                        layout="vertical"
                        margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
                        barSize={28}
                      >
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis type="number" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="stage" width={80} tick={{ fontSize: 13, fill: "#334155", fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(value) => [Number(value).toLocaleString(), ""]}
                          contentStyle={{ borderRadius: "10px", border: "1px solid #E2E8F0", fontSize: "13px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                          cursor={{ fill: "#F8FAFC" }}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Source category panels — 2x2 */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: "8px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Contacts Per Team
                </h3>
                <span style={{ fontSize: "13px", color: "#94A3B8" }}>
                  Prospects & leads by source channel
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {categoryCards.map((cat) => {
                  const goalPct = cat.title === "PPC" ? goals.ppcPercentGoal
                    : cat.title === "SEO" ? goals.seoPercentGoal
                    : cat.title === "Content" ? goals.contentPercentGoal
                    : null;
                  return (
                    <SourcePanel key={cat.title} {...cat} sourcesTotal={sourcesTotal} breakdown={sourceBreakdown[cat.title]} goalPercent={goalPct} />
                  );
                })}
              </div>
            </div>

            {/* === FUNNEL: Prospects → Leads → Visits → Won === */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr auto 1fr", gap: "0", alignItems: "stretch" }}>
              {/* Prospects */}
              <FunnelCard
                title="Prospects"
                subtitle="Browsing, not ready to talk"
                total={prospectsTotal}
                colour="#F59E0B"
                bg="#FFFBEB"
                rate={sourcesTotal > 0 ? `${((prospectsTotal / sourcesTotal) * 100).toFixed(1)}% of contacts` : undefined}
              >
                {prospects
                  .sort((a, b) => b.count - a.count)
                  .map((action) => (
                    <MiniRow
                      key={action.value}
                      label={PROSPECT_ACTIONS[action.value]}
                      count={action.count}
                    />
                  ))}
              </FunnelCard>

              <ConversionArrow
                rate={prospectsTotal > 0 ? ((leadsTotal / prospectsTotal) * 100).toFixed(1) : "0"}
                label="Prospect → Lead"
              />

              {/* Leads */}
              <FunnelCard
                title="Leads"
                subtitle="Want to talk"
                total={leadsTotal}
                colour="#3B82F6"
                bg="#EFF6FF"
                rate={sourcesTotal > 0 ? `${((leadsTotal / sourcesTotal) * 100).toFixed(1)}% of contacts` : undefined}
              >
                {leads
                  .sort((a, b) => b.count - a.count)
                  .map((action) => (
                    <MiniRow
                      key={action.value}
                      label={LEAD_ACTIONS[action.value]}
                      count={action.count}
                    />
                  ))}
              </FunnelCard>

              <ConversionArrow
                rate={leadsTotal > 0 ? (((homeVisits ?? 0) / leadsTotal) * 100).toFixed(1) : "0"}
                label="Lead → Visit"
              />

              {/* Home Visits */}
              <FunnelCard
                title="Home Visits"
                subtitle="Visit booked"
                total={homeVisits ?? 0}
                colour="#10B981"
                bg="#ECFDF5"
                rate={leadsTotal > 0 ? `${(((homeVisits ?? 0) / leadsTotal) * 100).toFixed(1)}% of leads` : undefined}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 0" }}>
                  <span style={{ fontSize: "48px", fontWeight: 800, color: "#059669", lineHeight: 1 }}>
                    {(homeVisits ?? 0).toLocaleString()}
                  </span>
                </div>
              </FunnelCard>

              <ConversionArrow
                rate={(homeVisits ?? 0) > 0 ? (((wonJobs ?? 0) / (homeVisits ?? 1)) * 100).toFixed(1) : "0"}
                label="Visit → Won"
              />

              {/* Won Jobs */}
              <FunnelCard
                title="Won Jobs"
                subtitle="Deal won, waiting for install"
                total={wonJobs ?? 0}
                colour="#059669"
                bg="#ECFDF5"
                rate={(homeVisits ?? 0) > 0 ? `${(((wonJobs ?? 0) / (homeVisits ?? 1)) * 100).toFixed(1)}% of visits` : undefined}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 0", gap: "8px" }}>
                  <span style={{ fontSize: "48px", fontWeight: 800, color: "#059669", lineHeight: 1 }}>
                    {(wonJobs ?? 0).toLocaleString()}
                  </span>
                  {wonValue !== null && wonValue > 0 && (
                    <span style={{ fontSize: "18px", fontWeight: 700, color: "#047857" }}>
                      £{wonValue.toLocaleString()}
                    </span>
                  )}
                </div>
              </FunnelCard>
            </div>

          </div>
        )}
      </main>

      {showSettings && <SettingsModal initialGoals={goals} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

/* ── Components ── */

const LIFECYCLE_COLOURS: Record<string, string> = {
  "Prospect": "#8B5CF6",
  "Warm - Prospect": "#A78BFA",
  "Lead": "#3B82F6",
  "Home Visit/Deal ": "#0EA5E9",
  "Won - Waiting": "#14B8A6",
  "Completed": "#10B981",
  "Nurture": "#F59E0B",
  "Deal Recovery": "#F97316",
  "Deal Lost": "#EF4444",
  "Cold - Subscribed": "#64748B",
  "Cold - Unsubscribed": "#94A3B8",
  "Suppliers & Muppets": "#CBD5E1",
};

function LifecyclePipeline({ stages, periodStages }: { stages: { label: string; value: string; count: number }[]; periodStages: { label: string; value: string; count: number }[] }) {
  const total = stages.reduce((s, st) => s + st.count, 0);
  const activeStages = stages.filter((s) => s.count > 0);
  const maxCount = Math.max(...activeStages.map((s) => s.count));
  const periodMap = new Map(periodStages.map((s) => [s.value, s.count]));
  const hasPeriod = periodStages.length > 0;

  return (
    <div
      style={{
        background: "white",
        borderRadius: "14px",
        border: "1px solid #E2E8F0",
        padding: "20px 24px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Lifecycle Stages
          </p>
          <span style={{ fontSize: "11px", color: "#94A3B8", background: "#F1F5F9", borderRadius: "6px", padding: "2px 8px" }}>
            Live totals
          </span>
        </div>
        <p style={{ fontSize: "13px", color: "#94A3B8", margin: 0, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontWeight: 700, color: "#0F172A" }}>{total.toLocaleString()}</span> contacts
        </p>
      </div>

      {/* Pipeline circles */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: "0", overflowX: "auto" }}>
        {activeStages.map((stage, i) => {
          const colour = LIFECYCLE_COLOURS[stage.label] ?? "#94A3B8";
          const sizeScale = Math.max(0.55, Math.min(1, stage.count / maxCount));
          const size = Math.round(48 + sizeScale * 36);
          const periodCount = periodMap.get(stage.value) ?? 0;

          return (
            <div key={stage.value} style={{ display: "flex", alignItems: "center" }}>
              {i > 0 && (
                <div style={{ width: "20px", height: "2px", background: "#E2E8F0", flexShrink: 0, marginTop: `${size / 2}px`, alignSelf: "flex-start" }} />
              )}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                <div
                  title={`${stage.label}: ${stage.count.toLocaleString()} (${((stage.count / total) * 100).toFixed(1)}%)`}
                  style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: "50%",
                    background: `${colour}18`,
                    border: `2.5px solid ${colour}`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.3s ease",
                  }}
                >
                  <span style={{ fontSize: size > 60 ? "16px" : "13px", fontWeight: 800, color: colour, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                    {stage.count.toLocaleString()}
                  </span>
                </div>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#64748B", textAlign: "center", maxWidth: "80px", lineHeight: 1.2 }}>
                  {stage.label}
                </span>
                {hasPeriod && (
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: periodCount > 0 ? "#059669" : "#CBD5E1",
                    background: periodCount > 0 ? "#ECFDF5" : "#F8FAFC",
                    borderRadius: "8px",
                    padding: "2px 8px",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {periodCount > 0 ? `+${periodCount.toLocaleString()}` : "—"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasPeriod && (
        <p style={{ fontSize: "11px", color: "#94A3B8", margin: "14px 0 0", textAlign: "center" }}>
          Green badges show contacts created in the selected date range
        </p>
      )}
    </div>
  );
}

function KpiCard({ label, value, colour, subtitle }: { label: string; value: number | null; colour: string; subtitle?: string }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "14px",
        padding: "20px",
        border: "1px solid #E2E8F0",
        borderBottom: `3px solid ${colour}`,
      }}
    >
      <p style={{ fontSize: "12px", fontWeight: 600, color: "#64748B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </p>
      <p style={{ fontSize: "32px", fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1 }}>
        {value !== null ? value.toLocaleString() : "—"}
      </p>
      {subtitle && (
        <p style={{ fontSize: "12px", color: "#94A3B8", margin: "6px 0 0" }}>{subtitle}</p>
      )}
    </div>
  );
}

function SourcePanel({
  title,
  total,
  sources,
  colour,
  bg,
  icon,
  sourcesTotal,
  breakdown,
  goalPercent,
}: {
  title: string;
  total: number;
  sources: LeadSource[];
  colour: string;
  bg: string;
  icon: string;
  sourcesTotal: number;
  breakdown?: { prospects: number; leads: number };
  goalPercent?: number | null;
}) {
  const filtered = sources.filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
  const pct = sourcesTotal > 0 ? ((total / sourcesTotal) * 100) : 0;
  const pctStr = pct.toFixed(1);

  return (
    <div
      style={{
        background: "white",
        borderRadius: "14px",
        padding: "20px",
        border: "1px solid #E2E8F0",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
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
            }}
          >
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: colour }} />
          </div>
          <div>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A", margin: 0 }}>{title}</p>
            <p style={{ fontSize: "11px", color: "#94A3B8", margin: "1px 0 0" }}>{icon}</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "24px", fontWeight: 800, color: colour, margin: 0, lineHeight: 1 }}>
            {total.toLocaleString()}
          </p>
          <p style={{ fontSize: "11px", color: "#94A3B8", margin: "2px 0 0" }}>{pctStr}%</p>
        </div>
      </div>

      {/* Prospect vs Lead badges */}
      {breakdown && (breakdown.prospects > 0 || breakdown.leads > 0) && (
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 1, background: "#FFFBEB", borderRadius: "8px", padding: "8px 12px", border: "1px solid #FDE68A" }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#92400E", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Prospects</p>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "#B45309", margin: "2px 0 0", lineHeight: 1 }}>{breakdown.prospects.toLocaleString()}</p>
          </div>
          <div style={{ flex: 1, background: "#EFF6FF", borderRadius: "8px", padding: "8px 12px", border: "1px solid #BFDBFE" }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#1E40AF", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Leads</p>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "#1D4ED8", margin: "2px 0 0", lineHeight: 1 }}>{breakdown.leads.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Goal vs actual */}
      {goalPercent && goalPercent > 0 && (
        <div style={{ background: "#F8FAFC", borderRadius: "8px", padding: "8px 12px", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "#64748B" }}>
            Goal: <strong>{goalPercent}%</strong> of contacts
          </span>
          <span style={{
            fontSize: "11px",
            fontWeight: 700,
            color: pct >= goalPercent ? "#059669" : "#DC2626",
            background: pct >= goalPercent ? "#ECFDF5" : "#FEF2F2",
            borderRadius: "6px",
            padding: "2px 8px",
          }}>
            {pct >= goalPercent ? "On target" : `${(goalPercent - pct).toFixed(1)}% below`}
          </span>
        </div>
      )}

      {/* Share bar */}
      <div style={{ background: "#F1F5F9", borderRadius: "4px", height: "4px", overflow: "hidden", position: "relative" }}>
        <div
          style={{
            width: `${sourcesTotal > 0 ? (total / sourcesTotal) * 100 : 0}%`,
            height: "100%",
            background: colour,
            borderRadius: "4px",
            transition: "width 0.4s ease",
          }}
        />
        {goalPercent && goalPercent > 0 && (
          <div style={{ position: "absolute", left: `${goalPercent}%`, top: "-2px", width: "2px", height: "8px", background: "#0F172A", borderRadius: "1px", opacity: 0.5 }} title={`Goal: ${goalPercent}%`} />
        )}
      </div>

      {/* Breakdown rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {filtered.map((s) => (
          <div key={s.value} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "#334155" }}>{s.label}</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
              {s.count.toLocaleString()}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ fontSize: "12px", color: "#CBD5E1", margin: 0 }}>No data</p>
        )}
      </div>
    </div>
  );
}

function ConversionArrow({ rate, label }: { rate: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 6px",
        minWidth: "60px",
      }}
    >
      <span style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>
        {rate}%
      </span>
      <svg width="24" height="16" viewBox="0 0 24 16" style={{ margin: "4px 0" }}>
        <path d="M4 8 L16 8 M12 3 L18 8 L12 13" stroke="#94A3B8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontSize: "9px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.3px", textAlign: "center", lineHeight: 1.2 }}>
        {label}
      </span>
    </div>
  );
}

function FunnelCard({
  title,
  subtitle,
  total,
  colour,
  bg,
  rate,
  children,
}: {
  title: string;
  subtitle: string;
  total: number;
  colour: string;
  bg: string;
  rate?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "14px",
        border: "1px solid #E2E8F0",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: bg,
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `2px solid ${colour}20`,
        }}
      >
        <div>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", margin: 0 }}>{title}</p>
          <p style={{ fontSize: "11px", color: "#64748B", margin: "2px 0 0" }}>{subtitle}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "24px", fontWeight: 800, color: colour, lineHeight: 1 }}>
            {total.toLocaleString()}
          </span>
          {rate && (
            <p style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", margin: "4px 0 0" }}>{rate}</p>
          )}
        </div>
      </div>
      <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: "6px" }}>
        {children}
      </div>
    </div>
  );
}

function MiniRow({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "13px", color: "#334155" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
        {count.toLocaleString()}
      </span>
    </div>
  );
}

function GoalBar({
  current,
  monthlyGoal,
  label,
  colour,
  from,
  to,
}: {
  current: number;
  monthlyGoal: number;
  label: string;
  colour: string;
  from: string;
  to: string;
}) {
  const fromDate = new Date(from + "T00:00:00");
  const toDate = new Date(to + "T23:59:59");
  const now = new Date();

  const rangeDays = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const dailyRate = monthlyGoal / 30.44;
  const goal = Math.max(1, Math.round(dailyRate * rangeDays));

  const pct = Math.min((current / goal) * 100, 100);
  const met = current >= goal;
  const barColour = met ? "#10B981" : colour;

  let expectedPct: number;
  let expected: number;
  let paceLabel: string;
  let periodLabel: string;

  if (now >= toDate) {
    expectedPct = 100;
    expected = goal;
    periodLabel = `${rangeDays} days (complete)`;
    paceLabel = `Target: ${goal}`;
  } else if (now <= fromDate) {
    expectedPct = 0;
    expected = 0;
    periodLabel = `${rangeDays} days (not started)`;
    paceLabel = "Not started yet";
  } else {
    const elapsed = Math.round((now.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    expectedPct = (elapsed / rangeDays) * 100;
    expected = Math.round((elapsed / rangeDays) * goal);
    periodLabel = `Day ${elapsed} of ${rangeDays}`;
    paceLabel = expected <= 1 ? "Just getting started" : `Target: ${expected} by now`;
  }

  const onTrack = current >= expected;
  const justStarted = now <= fromDate || (now > fromDate && Math.round((now.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) < 1);

  return (
    <div
      style={{
        background: "white",
        borderRadius: "14px",
        padding: "18px 20px",
        border: `1px solid ${met ? "#A7F3D0" : "#E2E8F0"}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontSize: "20px", fontWeight: 800, color: barColour }}>{current}</span>
          <span style={{ fontSize: "13px", color: "#94A3B8" }}>/ {goal}</span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: barColour,
              background: met ? "#D1FAE5" : `${colour}15`,
              borderRadius: "10px",
              padding: "2px 8px",
            }}
          >
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>

      <div style={{ position: "relative", background: "#F1F5F9", borderRadius: "4px", height: "6px", overflow: "visible", marginBottom: "8px" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: "4px",
            background: met ? "#10B981" : colour,
            transition: "width 0.4s ease",
            minWidth: current > 0 ? "4px" : "0",
          }}
        />
        {!met && !justStarted && (
          <div
            style={{
              position: "absolute",
              left: `${expectedPct}%`,
              top: "-3px",
              width: "2px",
              height: "12px",
              background: "#475569",
              borderRadius: "1px",
              opacity: 0.5,
            }}
            title={paceLabel}
          />
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: met ? "#059669" : justStarted ? "#64748B" : onTrack ? "#059669" : "#DC2626",
          }}
        >
          {met ? "Goal met!" : justStarted ? paceLabel : onTrack ? "On track" : "Behind pace"}
          {!met && !justStarted && (
            <span style={{ fontWeight: 400, color: "#94A3B8", marginLeft: "6px" }}>
              — {paceLabel.toLowerCase()}
            </span>
          )}
        </span>
        <span style={{ fontSize: "11px", color: "#94A3B8" }}>{periodLabel}</span>
      </div>
    </div>
  );
}
