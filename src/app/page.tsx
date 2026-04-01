"use client";

import { useState, useEffect, useCallback } from "react";

interface LeadSource {
  label: string;
  value: string;
  count: number;
}

interface Goals {
  leadGoalPerMonth: number | null;
  visitsGoalPerMonth: number | null;
}

const DEFAULT_GOALS: Goals = { leadGoalPerMonth: null, visitsGoalPerMonth: null };

function loadGoals(): Goals {
  if (typeof window === "undefined") return DEFAULT_GOALS;
  try {
    const raw = localStorage.getItem("acb_goals");
    if (raw) return { ...DEFAULT_GOALS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_GOALS;
}

function saveGoals(goals: Goals) {
  localStorage.setItem("acb_goals", JSON.stringify(goals));
}

/* ── Settings Modal ── */

function parseGoalDraft(val: string): number | null {
  const n = val.trim() === "" ? null : parseInt(val, 10);
  return n !== null && !isNaN(n) && n > 0 ? n : null;
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [goals, setGoals] = useState<Goals>(loadGoals);
  const [draftLead, setDraftLead] = useState<string>(
    goals.leadGoalPerMonth !== null ? String(goals.leadGoalPerMonth) : ""
  );
  const [draftVisitsMonth, setDraftVisitsMonth] = useState<string>(
    goals.visitsGoalPerMonth !== null ? String(goals.visitsGoalPerMonth) : ""
  );
  function handleSave() {
    const updated: Goals = {
      ...goals,
      leadGoalPerMonth: parseGoalDraft(draftLead),
      visitsGoalPerMonth: parseGoalDraft(draftVisitsMonth),
    };
    setGoals(updated);
    saveGoals(updated);
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
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: "relative",
          background: "white",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "480px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#1E293B" }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "#94A3B8",
              fontSize: "20px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #E2E8F0" }}>
          <button
            style={{
              padding: "12px 24px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#1E3A5F",
              background: "none",
              border: "none",
              borderBottom: "2px solid #1E3A5F",
              cursor: "pointer",
            }}
          >
            Goals
          </button>
        </div>

        {/* Goals Tab Content */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Lead Goal */}
          <div>
            <label
              htmlFor="leadGoal"
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 600,
                color: "#1E293B",
                marginBottom: "6px",
              }}
            >
              Lead Goal Per Month
            </label>
            <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 12px" }}>
              Set a monthly target for total leads.
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
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "15px",
                color: "#1E293B",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ borderTop: "1px solid #E2E8F0" }} />

          {/* Site Visits Booked — Monthly */}
          <div>
            <label
              htmlFor="visitsMonthGoal"
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 600,
                color: "#1E293B",
                marginBottom: "6px",
              }}
            >
              Site Visits Booked Per Month
            </label>
            <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 12px" }}>
              Monthly target for home visits booked.
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
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "15px",
                color: "#1E293B",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Weekly goal auto-calculated from monthly */}
          {parseGoalDraft(draftVisitsMonth) !== null && (() => {
            const m = parseGoalDraft(draftVisitsMonth)!;
            const dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
            return (
              <div
                style={{
                  background: "#F0FDF4",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  border: "1px solid #BBF7D0",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span style={{ fontSize: "13px", color: "#15803D", fontWeight: 600 }}>
                  ≈ {Math.round(m / (dim / 7))} per week
                </span>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>
                  (auto-calculated from monthly target)
                </span>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            padding: "16px 24px",
            borderTop: "1px solid #E2E8F0",
            background: "#F8FAFC",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "9px 20px",
              fontSize: "14px",
              fontWeight: 600,
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "white",
              color: "#64748B",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "9px 20px",
              fontSize: "14px",
              fontWeight: 600,
              borderRadius: "8px",
              border: "none",
              background: "#1E3A5F",
              color: "white",
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function getDefaultDates() {
  const now = new Date();
  const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  return { from, to };
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

function FunnelArrow({ rate, label }: { rate?: string; label?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 0",
        gap: "4px",
      }}
    >
      {rate && label && (
        <div
          style={{
            background: "#F1F5F9",
            borderRadius: "20px",
            padding: "4px 14px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#1E293B",
            }}
          >
            {rate}%
          </span>
          <span style={{ fontSize: "11px", color: "#94A3B8" }}>{label}</span>
        </div>
      )}
      <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
        <path
          d="M12 0 L12 20 M5 15 L12 22 L19 15"
          stroke="#CBD5E1"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const defaults = getDefaultDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [conversionActions, setConversionActions] = useState<LeadSource[]>([]);
  const [homeVisits, setHomeVisits] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);

  useEffect(() => {
    setGoals(loadGoals());
  }, [showSettings]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // GA4 Active Users
      const gaRes = await fetch(`/api/ga/active-users?from=${from}&to=${to}`);
      if (gaRes.ok) {
        const gaData = await gaRes.json();
        setActiveUsers(gaData.activeUsers);
      }

      const sourcesRes = await fetch(`/api/hubspot/lead-sources?from=${from}&to=${to}`);
      if (!sourcesRes.ok) {
        const text = await sourcesRes.text();
        throw new Error(text || "Failed to fetch sources");
      }
      const sourcesData = await sourcesRes.json();
      setSources(sourcesData.sources);

      const actionsRes = await fetch(`/api/hubspot/conversion-actions?from=${from}&to=${to}`);
      if (!actionsRes.ok) {
        const text = await actionsRes.text();
        throw new Error(text || "Failed to fetch conversion actions");
      }
      const actionsData = await actionsRes.json();
      setConversionActions(actionsData.actions);

      const visitsRes = await fetch(`/api/hubspot/home-visits?from=${from}&to=${to}`);
      if (!visitsRes.ok) {
        const text = await visitsRes.text();
        throw new Error(text || "Failed to fetch home visits");
      }
      const visitsData = await visitsRes.json();
      setHomeVisits(visitsData.total);
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
  const prospects = conversionActions.filter(
    (a) => a.value in PROSPECT_ACTIONS && a.count > 0
  );
  const prospectsTotal = prospects.reduce((sum, a) => sum + a.count, 0);
  const leads = conversionActions.filter(
    (a) => a.value in LEAD_ACTIONS && a.count > 0
  );
  const leadsTotal = leads.reduce((sum, a) => sum + a.count, 0);

  const hasData = sources.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      {/* Header */}
      <header
        style={{
          background: "linear-gradient(135deg, #1E3A5F 0%, #2D5F8B 100%)",
          padding: "20px 24px",
          color: "white",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 700,
                margin: 0,
                letterSpacing: "-0.3px",
              }}
            >
              Age Care Bathrooms
            </h1>
            <p
              style={{
                fontSize: "13px",
                margin: "4px 0 0",
                opacity: 0.7,
              }}
            >
              Marketing Funnel Dashboard
            </p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            title="Settings"
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: "8px",
              padding: "8px",
              cursor: "pointer",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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
      </header>

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
        {/* Date Range Picker */}
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "32px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            border: "1px solid #E2E8F0",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            gap: "12px",
          }}
        >
          <div>
            <label
              htmlFor="from"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "#64748B",
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              From
            </label>
            <input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "14px",
                color: "#1E293B",
              }}
            />
          </div>
          <div>
            <label
              htmlFor="to"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "#64748B",
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              To
            </label>
            <input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "14px",
                color: "#1E293B",
              }}
            />
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              background: loading ? "#94A3B8" : "#1E3A5F",
              color: "white",
              fontWeight: 600,
              borderRadius: "8px",
              padding: "9px 24px",
              fontSize: "14px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading..." : "Fetch Data"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#DC2626",
              borderRadius: "12px",
              padding: "12px 16px",
              marginBottom: "24px",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !hasData && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
            <p style={{ fontSize: "16px" }}>Fetching data from HubSpot...</p>
          </div>
        )}

        {hasData && (
          <>
            {/* === SECTION 1: Website Visitors === */}
            {activeUsers !== null && (
              <>
                <Section
                  title="Website Visitors"
                  subtitle="Total active users on the website"
                  total={activeUsers}
                  colour="#8B5CF6"
                  step={1}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                    }}
                  >
                    <div
                      style={{
                        background: "#F5F3FF",
                        borderRadius: "12px",
                        padding: "20px 32px",
                        textAlign: "center",
                        border: "2px solid #DDD6FE",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "48px",
                          fontWeight: 800,
                          color: "#7C3AED",
                          margin: 0,
                          lineHeight: 1,
                        }}
                      >
                        {activeUsers.toLocaleString()}
                      </p>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#6B7280",
                          marginTop: "8px",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Active Users
                      </p>
                    </div>
                    <div style={{ color: "#6B7280", fontSize: "14px" }}>
                      <p style={{ margin: 0 }}>
                        From <strong>Google Analytics</strong>
                      </p>
                    </div>
                  </div>
                </Section>

                <FunnelArrow
                  rate={sourcesTotal > 0 ? ((sourcesTotal / activeUsers) * 100).toFixed(2) : undefined}
                  label="became contacts"
                />
              </>
            )}

            {/* === SECTION 2: Contact Sources === */}
            <Section
              title="Contact Sources"
              subtitle="Where did they find us?"
              total={sourcesTotal}
              colour="#6366F1"
              step={activeUsers !== null ? 2 : 1}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: "12px",
                }}
              >
                {sources
                  .filter((s) => s.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .map((source) => (
                    <Card
                      key={source.value}
                      label={source.label}
                      count={source.count}
                      accentColour="#6366F1"
                    />
                  ))}
              </div>
            </Section>

            <FunnelArrow
              rate={sourcesTotal > 0 ? ((prospectsTotal / sourcesTotal) * 100).toFixed(1) : undefined}
              label="are prospects"
            />

            {/* === SECTION 2: Prospects === */}
            {prospects.length > 0 && (
              <>
                <Section
                  title="Prospects"
                  subtitle="Just browsing, not ready to talk yet"
                  total={prospectsTotal}
                  colour="#F59E0B"
                  step={activeUsers !== null ? 3 : 2}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {prospects
                      .sort((a, b) => b.count - a.count)
                      .map((action) => (
                        <Card
                          key={action.value}
                          label={PROSPECT_ACTIONS[action.value]}
                          count={action.count}
                          accentColour="#F59E0B"
                        />
                      ))}
                  </div>
                </Section>

                <FunnelArrow
                  rate={sourcesTotal > 0 ? ((leadsTotal / sourcesTotal) * 100).toFixed(1) : undefined}
                  label="are leads"
                />
              </>
            )}

            {/* === SECTION 3: Leads === */}
            {leads.length > 0 && (
              <>
                <Section
                  title="Leads"
                  subtitle="Actively interested, want to talk"
                  total={leadsTotal}
                  colour="#3B82F6"
                  step={activeUsers !== null ? 4 : 3}
                >
                  {goals.leadGoalPerMonth !== null && goals.leadGoalPerMonth > 0 && (
                    <GoalBar
                      current={leadsTotal}
                      goal={goals.leadGoalPerMonth}
                      label="Monthly Lead Goal"
                      colour="#3B82F6"
                      mode="month"
                    />
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {leads
                      .sort((a, b) => b.count - a.count)
                      .map((action) => (
                        <Card
                          key={action.value}
                          label={LEAD_ACTIONS[action.value]}
                          count={action.count}
                          accentColour="#3B82F6"
                        />
                      ))}
                  </div>
                </Section>

                <FunnelArrow
                  rate={leadsTotal > 0 && homeVisits !== null ? ((homeVisits / leadsTotal) * 100).toFixed(1) : undefined}
                  label="booked a visit"
                />
              </>
            )}

            {/* === SECTION 4: Home Visits Booked === */}
            {homeVisits !== null && (
              <Section
                title="Home Visits Booked"
                subtitle="Goal achieved"
                total={homeVisits}
                colour="#10B981"
                step={activeUsers !== null ? 5 : 4}
              >
                {goals.visitsGoalPerMonth !== null && goals.visitsGoalPerMonth > 0 && (
                  <GoalBar
                    current={homeVisits}
                    goal={goals.visitsGoalPerMonth}
                    label="Monthly Visit Goal"
                    colour="#10B981"
                    mode="month"
                  />
                )}
                {goals.visitsGoalPerMonth !== null && goals.visitsGoalPerMonth > 0 && (() => {
                  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
                  const weeksInMonth = daysInMonth / 7;
                  const weeklyGoal = Math.round(goals.visitsGoalPerMonth / weeksInMonth);
                  return weeklyGoal > 0 ? (
                    <GoalBar
                      current={homeVisits}
                      goal={weeklyGoal}
                      label="Weekly Visit Goal"
                      colour="#10B981"
                      mode="week"
                    />
                  ) : null;
                })()}
                <div
                  style={{
                    background: "#ECFDF5",
                    borderRadius: "12px",
                    padding: "20px 32px",
                    textAlign: "center",
                    border: "2px solid #A7F3D0",
                    display: "inline-block",
                  }}
                >
                  <p
                    style={{
                      fontSize: "48px",
                      fontWeight: 800,
                      color: "#059669",
                      margin: 0,
                      lineHeight: 1,
                    }}
                  >
                    {homeVisits.toLocaleString()}
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#6B7280",
                      marginTop: "8px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Visits Booked
                  </p>
                </div>
              </Section>
            )}

          </>
        )}
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

/* ── Reusable Components ── */

function Section({
  title,
  subtitle,
  total,
  colour,
  step,
  children,
}: {
  title: string;
  subtitle: string;
  total: number;
  colour: string;
  step: number;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "white",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        border: "1px solid #E2E8F0",
        borderTop: `3px solid ${colour}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: colour,
              color: "white",
              fontSize: "14px",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {step}
          </span>
          <div>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#1E293B",
                margin: 0,
              }}
            >
              {title}
            </h2>
            <p
              style={{
                fontSize: "13px",
                color: "#94A3B8",
                margin: "2px 0 0",
              }}
            >
              {subtitle}
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "#94A3B8",
              fontWeight: 600,
              margin: "0 0 2px",
            }}
          >
            Total
          </p>
          <p
            style={{
              fontSize: "28px",
              fontWeight: 800,
              color: colour,
              margin: 0,
              lineHeight: 1,
            }}
          >
            {total.toLocaleString()}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function GoalBar({
  current,
  goal,
  label,
  colour,
  mode,
}: {
  current: number;
  goal: number;
  label: string;
  colour: string;
  mode: "month" | "week";
}) {
  const pct = Math.min((current / goal) * 100, 100);
  const met = current >= goal;
  const barColour = met ? "#10B981" : colour;

  const now = new Date();
  let expectedPct: number;
  let expected: number;
  let paceLabel: string;
  let periodLabel: string;

  if (mode === "month") {
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    expectedPct = (dayOfMonth / daysInMonth) * 100;
    expected = Math.round((dayOfMonth / daysInMonth) * goal);
    periodLabel = `Day ${dayOfMonth} of ${daysInMonth}`;
    paceLabel = expected <= 1 ? "Just getting started" : `Target: ${expected} by now`;
  } else {
    const jsDay = now.getDay(); // 0=Sun
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;
    expectedPct = (dayOfWeek / 7) * 100;
    expected = Math.round((dayOfWeek / 7) * goal);
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    periodLabel = dayNames[dayOfWeek - 1];
    paceLabel = dayOfWeek <= 1 ? "Week just started" : `Target: ${expected} by ${dayNames[dayOfWeek - 1]}`;
  }

  const onTrack = current >= expected;
  // On day 1 / start of week, don't show behind — just "just started"
  const justStarted = (mode === "month" && now.getDate() <= 1) || (mode === "week" && (now.getDay() === 1 || now.getDay() === 0));

  return (
    <div
      style={{
        background: met ? "#ECFDF5" : "#F8FAFC",
        borderRadius: "12px",
        padding: "16px 20px",
        marginBottom: "14px",
        border: `1px solid ${met ? "#A7F3D0" : "#E2E8F0"}`,
      }}
    >
      {/* Top row: label + fraction */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontSize: "20px", fontWeight: 800, color: barColour }}>
            {current}
          </span>
          <span style={{ fontSize: "13px", color: "#94A3B8" }}>
            / {goal}
          </span>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: barColour,
              background: met ? "#D1FAE5" : `${colour}15`,
              borderRadius: "12px",
              padding: "2px 8px",
            }}
          >
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Progress bar with pace marker */}
      <div
        style={{
          position: "relative",
          background: "#E2E8F0",
          borderRadius: "6px",
          height: "8px",
          overflow: "visible",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: "6px",
            background: met
              ? "#10B981"
              : `linear-gradient(90deg, ${colour}, ${colour}CC)`,
            transition: "width 0.4s ease",
            minWidth: current > 0 ? "4px" : "0",
          }}
        />
        {!met && !justStarted && (
          <div
            style={{
              position: "absolute",
              left: `${expectedPct}%`,
              top: "-4px",
              width: "2px",
              height: "16px",
              background: "#475569",
              borderRadius: "1px",
              opacity: 0.6,
            }}
            title={paceLabel}
          />
        )}
      </div>

      {/* Status line */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: met
              ? "#059669"
              : justStarted
              ? "#64748B"
              : onTrack
              ? "#059669"
              : "#DC2626",
          }}
        >
          {met
            ? "Goal met!"
            : justStarted
            ? paceLabel
            : onTrack
            ? "On track"
            : "Behind pace"}
          {!met && !justStarted && (
            <span style={{ fontWeight: 400, color: "#94A3B8", marginLeft: "6px" }}>
              — {paceLabel.toLowerCase()}
            </span>
          )}
        </span>
        <span style={{ fontSize: "11px", color: "#94A3B8" }}>
          {periodLabel}
        </span>
      </div>
    </div>
  );
}

function Card({
  label,
  count,
  accentColour,
}: {
  label: string;
  count: number;
  accentColour: string;
}) {
  return (
    <div
      style={{
        background: "#F8FAFC",
        borderRadius: "10px",
        padding: "16px",
        borderLeft: `4px solid ${accentColour}`,
        transition: "transform 0.15s ease",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "#64748B",
          margin: "0 0 8px",
          lineHeight: 1.3,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "28px",
          fontWeight: 800,
          color: "#1E293B",
          margin: 0,
          lineHeight: 1,
        }}
      >
        {count.toLocaleString()}
      </p>
    </div>
  );
}
