"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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

const SOURCES = [
  { key: "PPC", label: "PPC", color: "#E8833A" },
  { key: "SEO", label: "SEO", color: "#30A46C" },
  { key: "Content", label: "Content", color: "#8E4EC6" },
  { key: "TV", label: "TV", color: "#D93D42" },
  { key: "Other", label: "Other", color: "#86868B" },
] as const;

type SourceKey = (typeof SOURCES)[number]["key"];

interface SourceDetail {
  value: string;
  label: string;
  count: number;
}

type ByCategory = Record<SourceKey, { total: number; sources: SourceDetail[] }>;

interface ConversionAction {
  label: string;
  value: string;
  count: number;
}

interface Selection {
  id: string;
  values: string[];
  count: number;
  label: string;
}

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

export default function CustomerJourneyPage() {
  const defaults = getDefaultRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [count, setCount] = useState<number | null>(null);
  const [bySource, setBySource] = useState<ByCategory | null>(null);
  const [actions, setActions] = useState<ConversionAction[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [automation, setAutomation] = useState<AutomationData | null>(null);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [automationExpanded, setAutomationExpanded] = useState(false);

  useEffect(() => {
    if (!automationExpanded) return;
    let cancelled = false;
    setAutomationLoading(true);
    fetch(`/api/hubspot/automation-emails?id=${WELCOME_FUNNEL_ID}&from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => {
        if (!cancelled) setAutomation(data);
      })
      .catch(() => {
        if (!cancelled) setAutomation({ emails: [], error: "Failed to load automation" });
      })
      .finally(() => {
        if (!cancelled) setAutomationLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [automationExpanded, from, to]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/hubspot/contacts-created?from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : Promise.reject(r.statusText))),
      fetch(`/api/hubspot/contacts-by-source?from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : Promise.reject(r.statusText))),
    ])
      .then(([totalData, sourceData]) => {
        if (cancelled) return;
        setCount(totalData.total);
        setBySource(sourceData.byCategory);
      })
      .catch(() => {
        if (!cancelled) {
          setCount(null);
          setBySource(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  useEffect(() => {
    let cancelled = false;
    setActionsLoading(true);
    const sourcesParam = selection ? `&sources=${encodeURIComponent(selection.values.join(","))}` : "";
    fetch(`/api/hubspot/conversion-actions?from=${from}&to=${to}${sourcesParam}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => {
        if (!cancelled) setActions(data.actions);
      })
      .catch(() => {
        if (!cancelled) setActions(null);
      })
      .finally(() => {
        if (!cancelled) setActionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, selection]);

  useEffect(() => {
    setSelection(null);
  }, [from, to]);

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const threeMonthsStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const todayStr = fmt(today);

  const ranges = [
    { label: "Today", from: todayStr, to: todayStr },
    {
      label: "This Week",
      from: fmt(weekStart),
      to: fmt((() => { const sun = new Date(weekStart); sun.setDate(sun.getDate() + 6); return sun; })()),
    },
    { label: "This Month", from: fmt(monthStart), to: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)) },
    { label: "Last Month", from: fmt(lastMonthStart), to: fmt(lastMonthEnd) },
    { label: "Last 3 Months", from: fmt(threeMonthsStart), to: fmt(lastMonthEnd) },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#FFFFFF",
        backgroundImage: "radial-gradient(circle, #D1D1D6 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        overflow: "auto",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          left: 0,
          right: 0,
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
        <Link
          href="/"
          style={{
            fontSize: "13px",
            color: "#007AFF",
            textDecoration: "none",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          ← Dashboard
        </Link>
        <h1 style={{ fontSize: "15px", fontWeight: 600, color: "#1D1D1F", margin: 0, whiteSpace: "nowrap" }}>
          Customer Journey
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
          width: "100%",
          minHeight: "calc(100vh - 53px)",
          padding: "60px 24px 80px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "center",
            alignItems: "flex-start",
            maxWidth: "100%",
          }}
        >
          {SOURCES.map((s) => {
            const cat = bySource?.[s.key];
            const total = cat?.total;
            const sources = cat?.sources?.filter((src) => src.count > 0) ?? [];
            const catId = `cat:${s.key}`;
            const isCatSelected = selection?.id === catId;
            const anySelected = selection !== null;
            const catSourceValues = cat?.sources?.map((src) => src.value) ?? [];
            return (
              <div
                key={s.key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  background: s.color,
                  color: "#FFFFFF",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 500,
                  boxShadow: isCatSelected ? `0 0 0 3px ${s.color}, 0 0 0 5px #FFFFFF, 0 2px 8px rgba(0,0,0,0.15)` : "0 1px 3px rgba(0,0,0,0.08)",
                  userSelect: "none",
                  minWidth: "170px",
                  opacity: anySelected && !isCatSelected && !selection?.values.some((v) => catSourceValues.includes(v)) ? 0.45 : 1,
                  transition: "opacity 0.15s, box-shadow 0.15s",
                }}
              >
                <button
                  onClick={() => {
                    if (!cat || catSourceValues.length === 0) return;
                    if (isCatSelected) {
                      setSelection(null);
                    } else {
                      setSelection({
                        id: catId,
                        values: catSourceValues,
                        count: cat.total,
                        label: s.label,
                      });
                    }
                  }}
                  disabled={!cat || catSourceValues.length === 0}
                  style={{
                    all: "unset",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    cursor: cat && catSourceValues.length > 0 ? "pointer" : "default",
                  }}
                >
                  <span>{s.label}</span>
                  <span
                    style={{
                      background: "rgba(255,255,255,0.25)",
                      borderRadius: "12px",
                      padding: "2px 10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      minWidth: "24px",
                      textAlign: "center",
                    }}
                  >
                    {loading ? "…" : total?.toLocaleString() ?? "—"}
                  </span>
                </button>

                {sources.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "2px" }}>
                    {sources.map((src) => {
                      const srcId = `src:${src.value}`;
                      const isSrcSelected = selection?.id === srcId;
                      return (
                        <button
                          key={src.value}
                          onClick={() => {
                            if (isSrcSelected) {
                              setSelection(null);
                            } else {
                              setSelection({
                                id: srcId,
                                values: [src.value],
                                count: src.count,
                                label: src.label,
                              });
                            }
                          }}
                          style={{
                            all: "unset",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                            background: isSrcSelected ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.18)",
                            borderRadius: "4px",
                            padding: "5px 10px",
                            fontSize: "11px",
                            fontWeight: 400,
                            cursor: "pointer",
                            outline: isSrcSelected ? "1.5px solid #FFFFFF" : "none",
                          }}
                        >
                          <span>{src.label}</span>
                          <span style={{ fontWeight: 600 }}>{src.count.toLocaleString()}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {(selection || actionsLoading) && (
          <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: "#86868B" }}>
            {selection && (
              <span>
                Showing paths for <strong style={{ color: "#1D1D1F" }}>{selection.label}</strong> ({selection.count.toLocaleString()} contacts)
              </span>
            )}
            {actionsLoading && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#007AFF" }}>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    border: "2px solid #D1D1D6",
                    borderTopColor: "#007AFF",
                    animation: "cj-spin 0.7s linear infinite",
                    display: "inline-block",
                  }}
                />
                Loading paths…
              </span>
            )}
            {selection && !actionsLoading && (
              <button
                onClick={() => setSelection(null)}
                style={{
                  background: "rgba(0,0,0,0.06)",
                  border: "none",
                  borderRadius: "6px",
                  padding: "3px 10px",
                  fontSize: "11px",
                  color: "#1D1D1F",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Clear
              </button>
            )}
          </div>
        )}
        <style jsx global>{`
          @keyframes cj-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>

        <div style={{ width: "2px", height: "40px", background: "#C7C7CC" }} />

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            justifyContent: "center",
            maxWidth: "900px",
            opacity: actionsLoading ? 0.45 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {actionsLoading && !actions ? (
            <div style={{ color: "#86868B", fontSize: "12px" }}>Loading actions…</div>
          ) : (
            (actions ?? [])
              .filter((a) => a.count > 0)
              .sort((a, b) => b.count - a.count)
              .map((a) => (
                <div
                  key={a.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#FFFFFF",
                    color: "#1D1D1F",
                    border: "1px solid #D1D1D6",
                    padding: "8px 12px 8px 14px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 500,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    userSelect: "none",
                  }}
                >
                  <span>{a.label}</span>
                  <span
                    style={{
                      background: "#F2F2F7",
                      color: "#1D1D1F",
                      borderRadius: "10px",
                      padding: "1px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      minWidth: "22px",
                      textAlign: "center",
                    }}
                  >
                    {a.count.toLocaleString()}
                  </span>
                </div>
              ))
          )}
          {!actionsLoading && actions && actions.filter((a) => a.count > 0).length === 0 && (
            <div style={{ color: "#86868B", fontSize: "12px" }}>No conversion actions in this period</div>
          )}
        </div>

        <div style={{ width: "2px", height: "40px", background: "#C7C7CC" }} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "#5B8DB8",
            color: "#FFFFFF",
            padding: "14px 20px 14px 32px",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: 500,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            userSelect: "none",
          }}
        >
          <span>Contact Created</span>
          <span
            style={{
              background: "rgba(255,255,255,0.25)",
              borderRadius: "12px",
              padding: "2px 10px",
              fontSize: "12px",
              fontWeight: 600,
              minWidth: "28px",
              textAlign: "center",
            }}
          >
            {loading ? "…" : (selection ? selection.count : count)?.toLocaleString() ?? "—"}
          </span>
        </div>

        <div style={{ width: "2px", height: "40px", background: "#C7C7CC" }} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", width: "100%", maxWidth: "720px" }}>
          <button
            onClick={() => {
              if (automation?.error) setAutomation(null);
              setAutomationExpanded((e) => !e);
            }}
            style={{
              all: "unset",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "#6F4FC9",
              color: "#FFFFFF",
              padding: "14px 20px 14px 24px",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 500,
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: automationExpanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.15s",
                fontSize: "10px",
                opacity: 0.75,
              }}
            >
              ▶
            </span>
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
              {automationLoading ? "…" : automation?.emails?.length ? `${automation.emails.length} emails` : "30 emails"}
            </span>
          </button>

          {automationExpanded && (
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
              {automationLoading && !automation && (
                <div style={{ padding: "20px", textAlign: "center", color: "#86868B", fontSize: "12px" }}>
                  Loading emails…
                </div>
              )}
              {automation?.error && (
                <div style={{ padding: "20px", textAlign: "center", color: "#D93D42", fontSize: "12px" }}>
                  {automation.error}
                </div>
              )}
              {automation?.emails?.length === 0 && !automation.error && !automationLoading && (
                <div style={{ padding: "20px", textAlign: "center", color: "#86868B", fontSize: "12px" }}>
                  No emails found in this workflow.
                </div>
              )}
              {automation?.emails?.map((em) => {
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
          )}
        </div>
      </div>
    </div>
  );
}
