"use client";

import { useEffect, useState } from "react";

interface AutomationEmail {
  id: string;
  order: number;
  name: string;
  subject?: string;
  sent?: number;
  opens?: number;
  clicks?: number;
  openRate?: number;
  clickRate?: number;
  clickThroughRate?: number;
}

interface AutomationData {
  workflow?: { id: string; name: string };
  emails: AutomationEmail[];
  error?: string;
}

const WELCOME_FUNNEL_ID = "2308647136";

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

export default function AutomationMapPage() {
  const defaults = getDefaultRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [data, setData] = useState<AutomationData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/hubspot/automation-emails?id=${WELCOME_FUNNEL_ID}&from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData({ emails: [], error: "Failed to load automation" });
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FFFFFF",
        backgroundImage: "radial-gradient(circle, #D1D1D6 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "saturate(180%) blur(20px)",
          borderBottom: "1px solid #E5E5EA",
          zIndex: 10,
          gap: "16px",
        }}
      >
        <h1 style={{ fontSize: "15px", fontWeight: 600, color: "#1D1D1F", margin: 0, whiteSpace: "nowrap" }}>
          Automation Map
        </h1>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", gap: "2px", background: "rgba(0,0,0,0.04)", borderRadius: "8px", padding: "3px" }}>
            {ranges.map((r) => {
              const active = from === r.from && to === r.to;
              return (
                <button
                  key={r.label}
                  onClick={() => { setFrom(r.from); setTo(r.to); }}
                  style={{
                    fontSize: "11px",
                    fontWeight: active ? 600 : 400,
                    color: active ? "white" : "#86868B",
                    background: active ? "#0071E3" : "transparent",
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
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(0,0,0,0.04)", borderRadius: "18px", padding: "6px 12px" }}>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: "12px", color: "#1D1D1F", outline: "none", fontFamily: "inherit" }}
            />
            <span style={{ color: "#AEAEB2", fontSize: "12px" }}>→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: "12px", color: "#1D1D1F", outline: "none", fontFamily: "inherit" }}
            />
          </div>
        </div>
      </header>

      <div
        style={{
          position: "relative",
          padding: "48px 24px 80px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
        }}
      >
        <div
          style={{
            background: "#1D1D1F",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 500,
            boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
            letterSpacing: "-0.005em",
          }}
        >
          Welcome Funnel entry
        </div>

        <div style={{ width: "2px", height: "40px", background: "#C7C7CC" }} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%", maxWidth: 760 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#6F4FC9",
              color: "#FFFFFF",
              padding: "14px 20px 14px 24px",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 500,
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              userSelect: "none",
            }}
          >
            <span>Welcome Funnel 30 in 30 (2025)</span>
            <span
              style={{
                background: "rgba(255,255,255,0.25)",
                borderRadius: "12px",
                padding: "2px 10px",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {loading && !data ? "…" : data?.emails?.length ? `${data.emails.length} emails` : "30 emails"}
            </span>
          </div>

          <div style={{ width: "2px", height: 20, background: "#C7C7CC" }} />

          <div
            style={{
              width: "100%",
              background: "#FFFFFF",
              border: "1px solid #E5E5EA",
              borderRadius: "8px",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            {loading && !data && (
              <div style={{ padding: "20px", textAlign: "center", color: "#86868B", fontSize: "12px" }}>
                Loading emails…
              </div>
            )}
            {data?.error && (
              <div style={{ padding: "20px", textAlign: "center", color: "#D93D42", fontSize: "12px" }}>
                {data.error}
              </div>
            )}
            {data?.emails?.length === 0 && !data.error && !loading && (
              <div style={{ padding: "20px", textAlign: "center", color: "#86868B", fontSize: "12px" }}>
                No emails found in this workflow.
              </div>
            )}
            {data?.emails?.map((em) => {
              const openPct = em.openRate != null ? em.openRate.toFixed(1) : null;
              const clickPct = em.clickRate != null ? em.clickRate.toFixed(1) : null;
              return (
                <div
                  key={em.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "32px 1fr auto auto",
                    alignItems: "center",
                    gap: "12px",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    background: "#F9F9FB",
                  }}
                >
                  <span style={{ color: "#86868B", fontWeight: 600, fontSize: "11px" }}>
                    #{em.order}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                    <span style={{ color: "#1D1D1F", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {em.name}
                    </span>
                    {em.subject && (
                      <span style={{ color: "#86868B", fontSize: "11px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {em.subject}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: "64px" }}>
                    <span style={{ color: "#86868B", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                      Open
                    </span>
                    <span style={{ color: "#1D1D1F", fontWeight: 600 }}>
                      {openPct != null ? `${openPct}%` : "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: "64px" }}>
                    <span style={{ color: "#86868B", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                      Click
                    </span>
                    <span style={{ color: "#1D1D1F", fontWeight: 600 }}>
                      {clickPct != null ? `${clickPct}%` : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
