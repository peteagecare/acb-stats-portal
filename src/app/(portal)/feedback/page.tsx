"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, ResponsiveContainer, Tooltip, Cell } from "recharts";

const HUBSPOT_HUB_ID = "25733939";

interface FeedbackBreakdown {
  value: string;
  label: string;
  count: number;
}

interface FeedbackItem {
  value: string;
  label: string;
  count: number;
  bySource: FeedbackBreakdown[];
  byAction: FeedbackBreakdown[];
}

interface OutreachFeedbackData {
  total: number;
  feedback: FeedbackItem[];
}

interface FeedbackRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  action: string;
  feedback: string;
  outreachDate: string;
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

function feedbackColour(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("home visit booked")) return "#10B981";
  if (l.includes("grant")) return "#10B981";
  if (l.includes("discussing with family")) return "#0071E3";
  if (l.includes("timing") || l.includes("not yet ready")) return "#0071E3";
  if (l.includes("brochure only")) return "#F59E0B";
  if (l.includes("too expensive")) return "#F59E0B";
  if (l.includes("competitor")) return "#F59E0B";
  if (l.includes("part fitting") || l.includes("supply only") || l.includes("flooring")) return "#94A3B8";
  if (l.includes("not answering")) return "#DC2626";
  if (l.includes("wrong contact")) return "#DC2626";
  if (l.includes("time wasters")) return "#DC2626";
  if (l.includes("doesn't know") || l.includes("didn't know")) return "#DC2626";
  return "#94A3B8";
}

function FeedbackListModal({ title, from, to, feedback, source, onClose }: {
  title: string;
  from: string;
  to: string;
  feedback?: string;
  source?: string;
  onClose: () => void;
}) {
  const [contacts, setContacts] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    let url = `/api/hubspot/feedback-list?from=${from}&to=${to}`;
    if (feedback) url += `&feedback=${encodeURIComponent(feedback)}`;
    if (source) url += `&source=${encodeURIComponent(source)}`;
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((data) => setContacts(data.contacts ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to, feedback, source]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: "20px",
          width: "100%", maxWidth: "1100px", maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid #F5F5F7",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600, color: "#1D1D1F" }}>{title}</h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#86868B" }}>
              {from} to {to} &middot; {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "#F5F5F7", border: "none", fontSize: "16px", color: "#86868B", cursor: "pointer", padding: "6px 10px", borderRadius: "10px", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          {loading && <div style={{ padding: "40px", textAlign: "center", color: "#86868B" }}>Loading...</div>}
          {error && <div style={{ padding: "40px", textAlign: "center", color: "#DC2626" }}>{error}</div>}
          {!loading && !error && contacts.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "#86868B" }}>No contacts found.</div>}
          {!loading && !error && contacts.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F5F5F7" }}>
                  {["Name", "Email", "Phone", "Source", "Action", "Feedback", "Outreach Date"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#86868B", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => {
                  const hsUrl = `https://app-eu1.hubspot.com/contacts/${HUBSPOT_HUB_ID}/record/0-1/${c.id}`;
                  const fmtDate = c.outreachDate ? new Date(c.outreachDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
                  return (
                    <tr key={c.id} onClick={() => window.open(hsUrl, "_blank")} style={{ borderBottom: "1px solid #F5F5F7", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAFA")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "#1D1D1F" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>{c.name} <span style={{ fontSize: "11px", color: "#AEAEB2" }}>↗</span></div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>{c.email}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>{c.phone || <span style={{ color: "#D1D1D6" }}>—</span>}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>{c.source || <span style={{ color: "#D1D1D6" }}>—</span>}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>{c.action || <span style={{ color: "#D1D1D6" }}>—</span>}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>{c.feedback}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>{fmtDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OutreachFeedbackPage() {
  const defaults = getDefaultRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [data, setData] = useState<OutreachFeedbackData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackListModal, setFeedbackListModal] = useState<{
    title: string;
    feedback?: string;
    source?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/hubspot/outreach-feedback?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError("Failed to load outreach feedback");
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
    { label: "This Month", from: fmt(monthStart), to: fmt(today) },
    { label: "Last Month", from: fmt(lastMonthStart), to: fmt(lastMonthEnd) },
    { label: "Last 3 Months", from: fmt(threeMonthsStart), to: fmt(lastMonthEnd) },
  ];

  const chartData = (data?.feedback ?? []).map((f) => ({
    name: f.label,
    feedbackValue: f.value,
    value: f.count,
    fill: feedbackColour(f.label),
    bySource: f.bySource,
    byAction: f.byAction,
  }));
  const positive = chartData.filter((d) => d.fill === "#10B981");
  const neutral = chartData.filter((d) => d.fill === "#0071E3" || d.fill === "#F59E0B");
  const negative = chartData.filter((d) => d.fill === "#DC2626" || d.fill === "#94A3B8");
  const positiveTotal = positive.reduce((s, d) => s + d.value, 0);
  const neutralTotal = neutral.reduce((s, d) => s + d.value, 0);
  const negativeTotal = negative.reduce((s, d) => s + d.value, 0);

  // Source aggregation for stacked bars
  const sourceMap = new Map<string, { sourceValue: string; total: number; feedbacks: { label: string; count: number; colour: string }[] }>();
  for (const f of data?.feedback ?? []) {
    for (const s of f.bySource) {
      let entry = sourceMap.get(s.label);
      if (!entry) { entry = { sourceValue: s.value, total: 0, feedbacks: [] }; sourceMap.set(s.label, entry); }
      entry.total += s.count;
      entry.feedbacks.push({ label: f.label, count: s.count, colour: feedbackColour(f.label) });
    }
  }
  const sources = [...sourceMap.entries()]
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.total - a.total);
  const maxSourceTotal = sources[0]?.total ?? 0;

  return (
    <div style={{ padding: "28px 28px 48px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "var(--color-text-primary, #1D1D1F)", margin: 0, letterSpacing: "-0.01em" }}>
            Outreach Feedback
          </h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary, #86868B)", margin: "4px 0 0" }}>
            How initial outreach calls landed — broken down by lead source and conversion action.
          </p>
        </div>

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
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(0,0,0,0.04)", borderRadius: "var(--radius-card, 18px)", padding: "6px 12px" }}>
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
      </div>

      {/* States */}
      {loading && !data && (
        <div style={{ padding: "60px", textAlign: "center", color: "#86868B", fontSize: "13px" }}>
          Loading feedback…
        </div>
      )}
      {error && !loading && (
        <div style={{ padding: "40px", textAlign: "center", color: "#D93D42", fontSize: "13px" }}>
          {error}
        </div>
      )}
      {!loading && !error && data && data.feedback.length === 0 && (
        <div style={{ padding: "60px", textAlign: "center", color: "#86868B", fontSize: "13px" }}>
          No outreach feedback recorded in this date range.
        </div>
      )}

      {/* Main content */}
      {data && data.feedback.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px" }}>
            <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#1D1D1F", margin: 0 }}>
              Feedback breakdown
            </h2>
            <span style={{ fontSize: "11px", color: "#AEAEB2" }}>
              {data.total} call{data.total !== 1 ? "s" : ""}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "12px" }}>
            {/* Donut */}
            <div style={{ background: "var(--bg-card, white)", borderRadius: "var(--radius-card, 18px)", boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "200px", height: "200px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      strokeWidth={2}
                      stroke="#fff"
                    >
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 500, color: "#059669", background: "#F0FDF4", borderRadius: "8px", padding: "4px 10px" }}>
                  {positiveTotal} positive
                </span>
                <span style={{ fontSize: "11px", fontWeight: 500, color: "#0071E3", background: "#EFF6FF", borderRadius: "8px", padding: "4px 10px" }}>
                  {neutralTotal} maybe later
                </span>
                <span style={{ fontSize: "11px", fontWeight: 500, color: "#DC2626", background: "#FEF2F2", borderRadius: "8px", padding: "4px 10px" }}>
                  {negativeTotal} lost
                </span>
              </div>
            </div>

            {/* Detail list */}
            <div style={{ background: "var(--bg-card, white)", borderRadius: "var(--radius-card, 18px)", boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))", padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {chartData.map((f) => {
                const pct = data.total > 0 ? Math.round((f.value / data.total) * 100) : 0;
                const top3 = [...f.bySource.slice(0, 2), ...f.byAction.slice(0, 2)]
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 3);
                return (
                  <div
                    key={f.name}
                    onClick={() => setFeedbackListModal({ title: `Feedback — ${f.name}`, feedback: f.feedbackValue })}
                    style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", borderRadius: "10px", padding: "4px 0", transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F5F7")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: f.fill, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#1D1D1F" }}>{f.name}</span>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                          <span style={{ fontSize: "10px", color: "#AEAEB2" }}>{pct}%</span>
                          <span style={{ fontSize: "14px", fontWeight: 600, color: "#1D1D1F", fontVariantNumeric: "tabular-nums" }}>{f.value}</span>
                        </div>
                      </div>
                      {top3.length > 0 && (
                        <p style={{ fontSize: "10px", color: "#86868B", margin: "2px 0 0" }}>
                          {top3.map((s, i) => (
                            <span key={i}>
                              {i > 0 && <span style={{ color: "#D2D2D7" }}> · </span>}
                              {s.label} <strong style={{ color: "#3A3A3C" }}>{s.count}</strong>
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By-source breakdown */}
          {sources.length > 0 && (
            <div style={{ background: "var(--bg-card, white)", borderRadius: "var(--radius-card, 18px)", boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))", padding: "20px", marginTop: "12px" }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "#86868B", margin: "0 0 14px" }}>
                Feedback by Lead Source
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {sources.map((src) => {
                  const positiveCount = src.feedbacks.filter((f) => f.colour === "#10B981").reduce((s, f) => s + f.count, 0);
                  const positivePct = src.total > 0 ? Math.round((positiveCount / src.total) * 100) : 0;
                  return (
                    <div
                      key={src.name}
                      onClick={() => setFeedbackListModal({ title: `Feedback — ${src.name}`, source: src.sourceValue })}
                      style={{ cursor: "pointer", borderRadius: "10px", padding: "6px 8px", transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F5F7")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#1D1D1F" }}>{src.name}</span>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                          <span style={{
                            fontSize: "9px",
                            fontWeight: 500,
                            color: positivePct >= 40 ? "#059669" : positivePct >= 20 ? "#F59E0B" : "#DC2626",
                            background: positivePct >= 40 ? "#F0FDF4" : positivePct >= 20 ? "#FFFBEB" : "#FEF2F2",
                            borderRadius: "4px",
                            padding: "1px 6px",
                          }}>
                            {positivePct}% positive
                          </span>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1D1D1F", fontVariantNumeric: "tabular-nums" }}>{src.total}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", height: "8px", borderRadius: "var(--radius-pill, 999px)", overflow: "hidden", background: "#F5F5F7" }}>
                        {src.feedbacks.map((f, fi) => (
                          <div key={fi} title={`${f.label}: ${f.count}`} style={{ width: `${(f.count / maxSourceTotal) * 100}%`, background: f.colour, transition: "width 0.3s" }} />
                        ))}
                      </div>
                      <p style={{ fontSize: "10px", color: "#86868B", margin: "3px 0 0" }}>
                        {src.feedbacks.slice(0, 3).map((f, i) => (
                          <span key={i}>
                            {i > 0 && <span style={{ color: "#D2D2D7" }}> · </span>}
                            <span style={{ color: f.colour === "#10B981" ? "#059669" : f.colour === "#DC2626" ? "#DC2626" : "#86868B" }}>{f.label}</span>{" "}
                            <strong style={{ color: "#3A3A3C" }}>{f.count}</strong>
                          </span>
                        ))}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {feedbackListModal && (
        <FeedbackListModal
          title={feedbackListModal.title}
          from={from}
          to={to}
          feedback={feedbackListModal.feedback}
          source={feedbackListModal.source}
          onClose={() => setFeedbackListModal(null)}
        />
      )}
    </div>
  );
}
