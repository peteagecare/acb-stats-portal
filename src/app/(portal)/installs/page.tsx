"use client";

import { useEffect, useState } from "react";

const HUBSPOT_HUB_ID = "25733939";

interface InstallMonth {
  key: string;
  label: string;
  monthName: string;
  year: number;
  count: number;
}

interface InstallsResponse {
  months: InstallMonth[];
}

interface Goals {
  installsGoalPerMonth: number | null;
}

interface InstallRow {
  id: string;
  name: string;
  installDate: string;
  amount: string;
  stage: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function InstallListModal({ title, from, to, onClose }: {
  title: string;
  from: string;
  to: string;
  onClose: () => void;
}) {
  const [deals, setDeals] = useState<InstallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/hubspot/install-list?from=${from}&to=${to}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((data) => setDeals(data.deals ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to]);

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
          maxWidth: "900px",
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
              {from} to {to} · {deals.length} install{deals.length !== 1 ? "s" : ""}
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
          {!loading && !error && deals.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", color: "#86868B" }}>
              No installs found.
            </div>
          )}
          {!loading && !error && deals.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F5F5F7" }}>
                  {["Deal Name", "Install Date", "Amount", "Stage"].map((h) => (
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
                {deals.map((d) => {
                  const hsUrl = `https://app-eu1.hubspot.com/contacts/${HUBSPOT_HUB_ID}/record/0-3/${d.id}`;
                  const fmtDate = d.installDate
                    ? new Date(d.installDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";
                  return (
                    <tr
                      key={d.id}
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
                          {d.name}{" "}
                          <span style={{ fontSize: "11px", color: "#AEAEB2" }}>↗</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>{fmtDate}</td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F" }}>
                        {d.amount
                          ? `£${parseFloat(d.amount).toLocaleString()}`
                          : <span style={{ color: "#D1D1D6" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1D1D1F", fontSize: "12px" }}>
                        {d.stage}
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

export default function InstallsPage() {
  const [data, setData] = useState<InstallsResponse | null>(null);
  const [goals, setGoals] = useState<Goals>({ installsGoalPerMonth: 32 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ title: string; from: string; to: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch("/api/hubspot/installs").then((r) =>
        r.ok ? r.json() : Promise.reject("Failed to load installs"),
      ),
      fetch("/api/goals").then((r) => (r.ok ? r.json() : { installsGoalPerMonth: 32 })),
    ])
      .then(([installsData, goalsData]) => {
        if (cancelled) return;
        setData(installsData as InstallsResponse);
        setGoals({ installsGoalPerMonth: goalsData?.installsGoalPerMonth ?? 32 });
      })
      .catch((e) => {
        if (!cancelled) setError(typeof e === "string" ? e : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const goal = goals.installsGoalPerMonth ?? 0;

  return (
    <div style={{ padding: "28px 28px 48px", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 600,
            color: "var(--color-text-primary, #1D1D1F)",
            margin: "0 0 6px",
            letterSpacing: "-0.02em",
          }}
        >
          Installs
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "var(--color-text-secondary, #86868B)",
            margin: 0,
          }}
        >
          Upcoming installations scheduled over the next three months. Independent of date range; excludes lost deals.
        </p>
      </header>

      {loading && !data && (
        <div
          style={{
            background: "var(--bg-card, white)",
            borderRadius: "var(--radius-card, 18px)",
            padding: "40px",
            textAlign: "center",
            color: "var(--color-text-secondary, #86868B)",
            fontSize: "13px",
            boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
          }}
        >
          Loading installs…
        </div>
      )}

      {error && (
        <div
          style={{
            background: "var(--bg-card, white)",
            borderRadius: "var(--radius-card, 18px)",
            padding: "40px",
            textAlign: "center",
            color: "#DC2626",
            fontSize: "13px",
            boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
          }}
        >
          {error}
        </div>
      )}

      {data && data.months.length > 0 && (
        <div
          style={{
            background: "var(--bg-card, white)",
            borderRadius: "var(--radius-card, 18px)",
            boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
            padding: "20px",
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
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-text-secondary, #86868B)",
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Upcoming Installs
            </p>
            {goal > 0 && (
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-tertiary, #AEAEB2)",
                  fontWeight: 600,
                }}
              >
                Goal: {goal} / month
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            {data.months.map((mo, i) => {
              const colours = ["#7C3AED", "#9333EA", "#A855F7"];
              const colour = colours[i] ?? "#7C3AED";
              const pctFill = goal > 0 ? Math.min((mo.count / goal) * 100, 100) : 0;
              const hit = goal > 0 && mo.count >= goal;
              const ringColour = hit ? "#10B981" : colour;
              const ringSize = 120;
              const sw = 8;
              const r = (ringSize - sw) / 2;
              const circ = 2 * Math.PI * r;
              const dashOff = circ - (pctFill / 100) * circ;

              const moIdx = MONTH_NAMES.indexOf(mo.monthName);
              const moFrom = `${mo.year}-${String(moIdx + 1).padStart(2, "0")}-01`;
              const lastDay = new Date(mo.year, moIdx + 1, 0).getDate();
              const moTo = `${mo.year}-${String(moIdx + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

              return (
                <div
                  key={mo.key}
                  onClick={() =>
                    setModal({
                      title: `Installs — ${mo.monthName} ${mo.year}`,
                      from: moFrom,
                      to: moTo,
                    })
                  }
                  style={{
                    background: "white",
                    boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
                    borderRadius: "20px",
                    padding: "24px 12px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    gap: "6px",
                    cursor: "pointer",
                    transition: "box-shadow 0.15s ease, transform 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow =
                      "var(--shadow-card-hover, 0 4px 20px rgba(0,0,0,0.1))";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow =
                      "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--color-text-tertiary, #AEAEB2)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {mo.label}
                  </span>

                  <div
                    style={{
                      position: "relative",
                      width: `${ringSize}px`,
                      height: `${ringSize}px`,
                      margin: "4px 0",
                    }}
                  >
                    <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
                      <circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={r}
                        fill="none"
                        stroke="#F5F5F7"
                        strokeWidth={sw}
                      />
                      <circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={r}
                        fill="none"
                        stroke={ringColour}
                        strokeWidth={sw}
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={dashOff}
                        style={{
                          transition: "stroke-dashoffset 0.6s cubic-bezier(0.25,0.1,0.25,1)",
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
                          color: "var(--color-text-primary, #1D1D1F)",
                          lineHeight: 1,
                        }}
                      >
                        {mo.count}
                      </span>
                      {goal > 0 && (
                        <span
                          style={{
                            fontSize: "10px",
                            color: "var(--color-text-tertiary, #AEAEB2)",
                            marginTop: "2px",
                          }}
                        >
                          / {goal}
                        </span>
                      )}
                    </div>
                  </div>

                  <p
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--color-text-primary, #1D1D1F)",
                      margin: 0,
                    }}
                  >
                    {mo.monthName} {mo.year}
                  </p>

                  {hit && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 500,
                        color: "#059669",
                        background: "#F0FDF4",
                        borderRadius: "var(--radius-pill, 999px)",
                        padding: "3px 10px",
                      }}
                    >
                      Goal met (+{mo.count - goal})
                    </span>
                  )}
                  {goal > 0 && !hit && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 500,
                        color: colour,
                        background: `${colour}10`,
                        borderRadius: "var(--radius-pill, 999px)",
                        padding: "3px 10px",
                      }}
                    >
                      {goal - mo.count} more needed
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data && data.months.length === 0 && !loading && (
        <div
          style={{
            background: "var(--bg-card, white)",
            borderRadius: "var(--radius-card, 18px)",
            padding: "40px",
            textAlign: "center",
            color: "var(--color-text-secondary, #86868B)",
            fontSize: "13px",
            boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.04))",
          }}
        >
          No upcoming installs found.
        </div>
      )}

      {modal && (
        <InstallListModal
          title={modal.title}
          from={modal.from}
          to={modal.to}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
