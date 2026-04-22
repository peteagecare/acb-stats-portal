"use client";

import { useEffect, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────── */

interface UpcomingWeek {
  label: string;
  weekStart: string;
  weekEnd: string;
  count: number;
  cancelled: number;
  bySalesman: Record<string, number>;
}

interface SiteVisitsData {
  inPeriod: number;
  cancelled: number;
  upcoming: UpcomingWeek[];
}

interface SiteVisitRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  visitDate: string;
  salesman: string;
  status: string;
}

interface Goals {
  visitsGoalPerMonth: number | null;
  siteVisitsGoalPerWeek: number | null;
}

/* ──────────────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────────────────── */

const HUBSPOT_HUB_ID = "25733939";
const SALESMEN = ["Andy", "Barry", "Brian", "Dean", "Kevin", "Tony"];
const SALESMAN_GOALS: Record<string, number> = {
  Andy: 10,
  Barry: 10,
  Brian: 6,
  Dean: 10,
  Kevin: 10,
  Tony: 10,
};

/* ──────────────────────────────────────────────────────────────────────
 * Date helpers
 * ────────────────────────────────────────────────────────────────────── */

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
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
/** Pro-rates a monthly goal against the currently-selected range. */
function proratedGoal(
  monthly: number | null,
  from: string,
  to: string
): number | null {
  if (monthly == null) return null;
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromDate = new Date(fy, fm - 1, fd);
  const toDate = new Date(ty, tm - 1, td);
  const days = Math.max(
    1,
    Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1
  );
  const refMonthDays = daysInMonth(fy, fm - 1);
  return Math.round((monthly / refMonthDays) * days);
}

/* ──────────────────────────────────────────────────────────────────────
 * Site Visit List Modal (click-through drilldown)
 * ────────────────────────────────────────────────────────────────────── */

type ModalState = {
  title: string;
  from: string;
  to: string;
  mode: "booked" | "scheduled";
  salesman?: string;
};

function SiteVisitListModal({
  title,
  from,
  to,
  mode,
  salesman,
  onClose,
}: ModalState & { onClose: () => void }) {
  const [contacts, setContacts] = useState<SiteVisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    let url = `/api/hubspot/site-visit-list?from=${from}&to=${to}&mode=${mode}`;
    if (salesman) url += `&salesman=${encodeURIComponent(salesman)}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setContacts(data.contacts ?? []);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, mode, salesman]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "1100px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #F5F5F7",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600, color: "#1D1D1F" }}>
              {title}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#86868B" }}>
              {from} to {to} &middot; {contacts.length} visit
              {contacts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#F5F5F7",
              border: "none",
              fontSize: "16px",
              color: "#86868B",
              cursor: "pointer",
              padding: "6px 10px",
              borderRadius: "10px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          {loading && (
            <div style={{ padding: "40px", textAlign: "center", color: "#86868B" }}>
              Loading...
            </div>
          )}
          {error && (
            <div style={{ padding: "40px", textAlign: "center", color: "#DC2626" }}>
              {error}
            </div>
          )}
          {!loading && !error && contacts.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", color: "#86868B" }}>
              No visits found.
            </div>
          )}
          {!loading && !error && contacts.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F5F5F7" }}>
                  {["Name", "Email", "Phone", "Source", "Visit Date", "Salesman"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 16px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: "#86868B",
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => {
                  const hsUrl = `https://app-eu1.hubspot.com/contacts/${HUBSPOT_HUB_ID}/record/0-1/${c.id}`;
                  const fmtDate = c.visitDate
                    ? new Date(c.visitDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";
                  return (
                    <tr
                      key={c.id}
                      onClick={() => window.open(hsUrl, "_blank")}
                      style={{
                        borderBottom: "1px solid #F5F5F7",
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAFA")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "#1D1D1F" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {c.name}
                          <span style={{ fontSize: "11px", color: "#AEAEB2" }}>↗</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>{c.email}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>
                        {c.phone || <span style={{ color: "#D1D1D6" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>
                        {c.source || <span style={{ color: "#D1D1D6" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>
                        {fmtDate}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>
                        {c.salesman || <span style={{ color: "#D1D1D6" }}>—</span>}
                      </td>
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

/* ──────────────────────────────────────────────────────────────────────
 * Page
 * ────────────────────────────────────────────────────────────────────── */

export default function SiteVisitsPage() {
  const defaults = getDefaultRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [data, setData] = useState<SiteVisitsData | null>(null);
  const [goals, setGoals] = useState<Goals>({
    visitsGoalPerMonth: null,
    siteVisitsGoalPerWeek: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);

  // Load goals once
  useEffect(() => {
    let cancelled = false;
    fetch("/api/goals")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((g: Goals) => {
        if (!cancelled) setGoals(g);
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load site-visits whenever the range changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/hubspot/site-visits?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: SiteVisitsData) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError("Failed to load site visits.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  // Preset ranges (matches automation-map pattern)
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

  const fmtDay = (s: string) => {
    const [, m, d] = s.split("-");
    return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-page, #FFFFFF)",
      }}
    >
      {/* Sticky header with date picker */}
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
        <h1
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "#1D1D1F",
            margin: 0,
            whiteSpace: "nowrap",
          }}
        >
          Site Visits
        </h1>

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
      </header>

      <div style={{ padding: "28px 28px 48px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: "24px" }}>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: 600,
              color: "#1D1D1F",
              margin: "0 0 6px",
              letterSpacing: "-0.01em",
            }}
          >
            Site Visits
          </h2>
          <p style={{ fontSize: "13px", color: "#86868B", margin: 0 }}>
            Home visits booked in the selected period, plus the four-week forward-looking diary
            and per-salesman workload.
          </p>
        </div>

        {loading && !data && (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "#86868B",
              fontSize: "13px",
            }}
          >
            Loading site visits…
          </div>
        )}

        {error && !data && (
          <div
            style={{
              padding: "20px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: "12px",
              color: "#DC2626",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* ── This period + Upcoming calendar ───────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: "10px" }}>
              {/* In-period progress ring */}
              {(() => {
                const visitGoal =
                  proratedGoal(goals.visitsGoalPerMonth, from, to) ?? data.inPeriod;
                const pctFill =
                  visitGoal > 0 ? Math.min((data.inPeriod / visitGoal) * 100, 100) : 0;
                const hit = visitGoal > 0 && data.inPeriod >= visitGoal;
                const ringColour = hit ? "#10B981" : "#0071E3";
                const ringSize = 120;
                const strokeW = 7;
                const r = (ringSize - strokeW) / 2;
                const circ = 2 * Math.PI * r;
                const dashOff = circ - (pctFill / 100) * circ;
                return (
                  <div
                    onClick={() =>
                      setModal({
                        title: "Site Visits — Booked In Period",
                        from,
                        to,
                        mode: "booked",
                      })
                    }
                    style={{
                      background: "white",
                      borderRadius: "20px",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                      padding: "24px 20px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "12px",
                      cursor: "pointer",
                      transition: "box-shadow 0.15s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)")
                    }
                  >
                    <p
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#1D1D1F",
                        margin: 0,
                      }}
                    >
                      Booked In Period
                    </p>

                    <div
                      style={{
                        position: "relative",
                        width: `${ringSize}px`,
                        height: `${ringSize}px`,
                      }}
                    >
                      <svg
                        width={ringSize}
                        height={ringSize}
                        style={{ transform: "rotate(-90deg)" }}
                      >
                        <circle
                          cx={ringSize / 2}
                          cy={ringSize / 2}
                          r={r}
                          fill="none"
                          stroke="#F5F5F7"
                          strokeWidth={strokeW}
                        />
                        <circle
                          cx={ringSize / 2}
                          cy={ringSize / 2}
                          r={r}
                          fill="none"
                          stroke={ringColour}
                          strokeWidth={strokeW}
                          strokeLinecap="round"
                          strokeDasharray={circ}
                          strokeDashoffset={dashOff}
                          style={{
                            transition:
                              "stroke-dashoffset 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)",
                          }}
                        />
                      </svg>
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "32px",
                            fontWeight: 600,
                            color: "#1D1D1F",
                            lineHeight: 1,
                          }}
                        >
                          {data.inPeriod}
                        </span>
                        {visitGoal > 0 && (
                          <span
                            style={{ fontSize: "10px", color: "#AEAEB2", marginTop: "2px" }}
                          >
                            / {visitGoal}
                          </span>
                        )}
                      </div>
                    </div>

                    {hit ? (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 500,
                          color: "#059669",
                          background: "#F0FDF4",
                          borderRadius: "6px",
                          padding: "3px 10px",
                        }}
                      >
                        Goal met
                      </span>
                    ) : visitGoal > 0 ? (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 500,
                          color: "#0071E3",
                          background: "#EFF6FF",
                          borderRadius: "6px",
                          padding: "3px 10px",
                        }}
                      >
                        {visitGoal - data.inPeriod} more needed
                      </span>
                    ) : null}

                    {data.cancelled > 0 && (
                      <div
                        style={{
                          borderTop: "1px solid rgba(0,0,0,0.04)",
                          paddingTop: "10px",
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="#DC2626"
                            strokeWidth="2"
                          />
                          <path
                            d="M15 9l-6 6M9 9l6 6"
                            stroke="#DC2626"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span
                          style={{ fontSize: "16px", fontWeight: 600, color: "#DC2626" }}
                        >
                          {data.cancelled}
                        </span>
                        <span style={{ fontSize: "11px", color: "#AEAEB2" }}>
                          cancelled
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 4-week forward calendar */}
              <div
                style={{
                  background: "white",
                  borderRadius: "18px",
                  border: "none",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: "12px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#86868B",
                      margin: 0,
                    }}
                  >
                    Upcoming Calendar
                  </p>
                  <span style={{ fontSize: "10px", color: "#AEAEB2", fontWeight: 600 }}>
                    Independent of date range
                    {goals.siteVisitsGoalPerWeek != null && (
                      <> · Weekly target {goals.siteVisitsGoalPerWeek}</>
                    )}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "12px",
                  }}
                >
                  {data.upcoming.map((wk, i) => {
                    const colours = ["#0071E3", "#6366F1", "#8B5CF6", "#A855F7"];
                    const colour = colours[i] ?? "#0071E3";
                    const goal = goals.siteVisitsGoalPerWeek ?? 10;
                    const pctFill = Math.min((wk.count / goal) * 100, 100);
                    const hit = wk.count >= goal;
                    const ringColour = hit ? "#10B981" : colour;
                    const ringSize = 100;
                    const strokeWidth = 6;
                    const radius = (ringSize - strokeWidth) / 2;
                    const circumference = 2 * Math.PI * radius;
                    const dashOffset = circumference - (pctFill / 100) * circumference;
                    return (
                      <div
                        key={wk.label}
                        onClick={() =>
                          setModal({
                            title: `Site Visits — ${wk.label}`,
                            from: wk.weekStart,
                            to: wk.weekEnd,
                            mode: "scheduled",
                          })
                        }
                        style={{
                          background: "white",
                          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                          borderRadius: "20px",
                          padding: "20px 12px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          textAlign: "center",
                          gap: "4px",
                          cursor: "pointer",
                          transition: "box-shadow 0.15s ease",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.boxShadow =
                            "0 4px 20px rgba(0,0,0,0.1)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.boxShadow =
                            "0 2px 12px rgba(0,0,0,0.04)")
                        }
                      >
                        <div
                          style={{
                            position: "relative",
                            width: `${ringSize}px`,
                            height: `${ringSize}px`,
                            marginBottom: "4px",
                          }}
                        >
                          <svg
                            width={ringSize}
                            height={ringSize}
                            style={{ transform: "rotate(-90deg)" }}
                          >
                            <circle
                              cx={ringSize / 2}
                              cy={ringSize / 2}
                              r={radius}
                              fill="none"
                              stroke="#F5F5F7"
                              strokeWidth={strokeWidth}
                            />
                            <circle
                              cx={ringSize / 2}
                              cy={ringSize / 2}
                              r={radius}
                              fill="none"
                              stroke={ringColour}
                              strokeWidth={strokeWidth}
                              strokeLinecap="round"
                              strokeDasharray={circumference}
                              strokeDashoffset={dashOffset}
                              style={{
                                transition:
                                  "stroke-dashoffset 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)",
                              }}
                            />
                          </svg>
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "28px",
                                fontWeight: 600,
                                color: "#1D1D1F",
                                lineHeight: 1,
                              }}
                            >
                              {wk.count}
                            </span>
                            <span
                              style={{
                                fontSize: "9px",
                                color: "#AEAEB2",
                                marginTop: "2px",
                              }}
                            >
                              / {goal}
                            </span>
                          </div>
                        </div>

                        <p
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#1D1D1F",
                            margin: 0,
                          }}
                        >
                          {wk.label}
                        </p>
                        <p
                          style={{ fontSize: "10px", color: "#AEAEB2", margin: 0 }}
                        >
                          {fmtDay(wk.weekStart)} – {fmtDay(wk.weekEnd)}
                        </p>
                        {hit && (
                          <span
                            style={{
                              fontSize: "9px",
                              fontWeight: 500,
                              color: "#059669",
                              background: "#F0FDF4",
                              borderRadius: "6px",
                              padding: "2px 8px",
                              marginTop: "2px",
                            }}
                          >
                            Goal met
                          </span>
                        )}
                        {!hit && wk.count > 0 && (
                          <span
                            style={{
                              fontSize: "9px",
                              fontWeight: 500,
                              color: colour,
                              background: `${colour}10`,
                              borderRadius: "6px",
                              padding: "2px 8px",
                              marginTop: "2px",
                            }}
                          >
                            {goal - wk.count} more needed
                          </span>
                        )}
                        {wk.cancelled > 0 && (
                          <span
                            style={{
                              fontSize: "9px",
                              fontWeight: 500,
                              color: "#DC2626",
                              background: "#FEF2F2",
                              borderRadius: "6px",
                              padding: "2px 8px",
                              marginTop: "2px",
                            }}
                          >
                            {wk.cancelled} cancelled
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Salesman workload ─────────────────────────────── */}
            <div
              style={{
                background: "white",
                borderRadius: "20px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                padding: "20px",
                marginTop: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: "16px",
                }}
              >
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#1D1D1F",
                    margin: 0,
                  }}
                >
                  Salesman Workload
                </p>
                <span style={{ fontSize: "10px", color: "#AEAEB2" }}>Weekly targets</span>
              </div>
              <div
                style={{
                  borderRadius: "12px",
                  border: "1px solid #F1F5F9",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 50px repeat(4, 1fr)",
                    background: "#F8FAFC",
                    borderBottom: "1px solid #F1F5F9",
                  }}
                >
                  <div
                    style={{
                      padding: "10px 14px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#64748B",
                      textTransform: "uppercase",
                    }}
                  >
                    Name
                  </div>
                  <div
                    style={{
                      padding: "10px 6px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#64748B",
                      textTransform: "uppercase",
                      textAlign: "center",
                    }}
                  >
                    Goal
                  </div>
                  {data.upcoming.map((wk) => (
                    <div
                      key={wk.label}
                      style={{
                        padding: "10px 8px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#64748B",
                        textAlign: "center",
                        textTransform: "uppercase",
                        borderLeft: "1px solid #F1F5F9",
                      }}
                    >
                      {wk.label}
                    </div>
                  ))}
                </div>
                {SALESMEN.map((name, rowIdx) => {
                  const goal = SALESMAN_GOALS[name] ?? 10;
                  return (
                    <div
                      key={name}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "100px 50px repeat(4, 1fr)",
                        borderBottom:
                          rowIdx < SALESMEN.length - 1 ? "1px solid #F1F5F9" : "none",
                        background: rowIdx % 2 === 1 ? "#FAFBFC" : "white",
                      }}
                    >
                      <div
                        style={{
                          padding: "12px 14px",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#1D1D1F",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {name}
                      </div>
                      <div
                        style={{
                          padding: "12px 6px",
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#94A3B8",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {goal}
                      </div>
                      {data.upcoming.map((wk) => {
                        const n = wk.bySalesman?.[name] ?? 0;
                        const pctFill = Math.min((n / goal) * 100, 100);
                        const hit = n >= goal;
                        const ringCol = hit
                          ? "#10B981"
                          : n >= goal * 0.5
                          ? "#F59E0B"
                          : n > 0
                          ? "#0071E3"
                          : "#E5E5EA";
                        const rs = 44;
                        const sw = 3.5;
                        const r = (rs - sw) / 2;
                        const circ = 2 * Math.PI * r;
                        const dashOff = circ - (pctFill / 100) * circ;
                        return (
                          <div
                            key={`${name}-${wk.label}`}
                            onClick={() =>
                              n > 0 &&
                              setModal({
                                title: `${name} — ${wk.label}`,
                                from: wk.weekStart,
                                to: wk.weekEnd,
                                mode: "scheduled",
                                salesman: name,
                              })
                            }
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "8px 4px",
                              cursor: n > 0 ? "pointer" : undefined,
                              borderLeft: "1px solid #F1F5F9",
                              transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              if (n > 0)
                                e.currentTarget.style.background = "#F0F4FF";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <div
                              style={{
                                position: "relative",
                                width: `${rs}px`,
                                height: `${rs}px`,
                              }}
                            >
                              <svg
                                width={rs}
                                height={rs}
                                style={{ transform: "rotate(-90deg)" }}
                              >
                                <circle
                                  cx={rs / 2}
                                  cy={rs / 2}
                                  r={r}
                                  fill="none"
                                  stroke="#F1F5F9"
                                  strokeWidth={sw}
                                />
                                <circle
                                  cx={rs / 2}
                                  cy={rs / 2}
                                  r={r}
                                  fill="none"
                                  stroke={ringCol}
                                  strokeWidth={sw}
                                  strokeLinecap="round"
                                  strokeDasharray={circ}
                                  strokeDashoffset={dashOff}
                                  style={{
                                    transition:
                                      "stroke-dashoffset 0.5s cubic-bezier(0.25,0.1,0.25,1)",
                                  }}
                                />
                              </svg>
                              <div
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    color: n > 0 ? "#1D1D1F" : "#D2D2D7",
                                    lineHeight: 1,
                                  }}
                                >
                                  {n}
                                </span>
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: "9px",
                                fontWeight: 500,
                                color: hit
                                  ? "#059669"
                                  : n > 0
                                  ? "#94A3B8"
                                  : "#D2D2D7",
                                marginTop: "2px",
                              }}
                            >
                              {hit ? "Target met" : `${n} / ${goal}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {modal && <SiteVisitListModal {...modal} onClose={() => setModal(null)} />}
    </div>
  );
}
