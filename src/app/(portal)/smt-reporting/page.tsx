"use client";

import React, { useEffect, useMemo, useState } from "react";

const PROSPECT_ACTIONS = new Set([
  "Brochure Download Form",
  "Flipbook Form",
  "VAT Exempt Checker",
  "Pricing Guide",
  "Physical Brochure Request",
  "Newsletter Sign Up",
]);
const LEAD_ACTIONS = new Set([
  "Brochure - Call Me",
  "Request A Callback Form",
  "Contact Form",
  "Free Home Design Form",
  "Phone Call",
  "Walk In Bath Form",
  "Direct Email",
  "Brochure - Home Visit",
  "Pricing Guide Home Visit",
]);

interface ConversionAction {
  label: string;
  value: string;
  count: number;
}

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

const MANUAL_PLATFORMS = ["google", "bing", "meta", "reddit"] as const;
type ManualPlatform = (typeof MANUAL_PLATFORMS)[number];
type ManualSpend = Record<ManualPlatform, number>;

const MANUAL_LABELS: Record<ManualPlatform, string> = {
  google: "Google",
  bing: "Bing",
  meta: "Meta",
  reddit: "Reddit",
};

function manualSpendKey(from: string, to: string): string {
  return `smt-spend:${from}:${to}`;
}
function loadManualSpend(from: string, to: string): ManualSpend {
  const empty: ManualSpend = { google: 0, bing: 0, meta: 0, reddit: 0 };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(manualSpendKey(from, to));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<ManualSpend>;
    return {
      google: Number(parsed.google) || 0,
      bing: Number(parsed.bing) || 0,
      meta: Number(parsed.meta) || 0,
      reddit: Number(parsed.reddit) || 0,
    };
  } catch {
    return empty;
  }
}
function saveManualSpend(from: string, to: string, spend: ManualSpend): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(manualSpendKey(from, to), JSON.stringify(spend));
  } catch {
    // ignore quota errors
  }
}

function rangeDays(from: string, to: string): number {
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T23:59:59`);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return 0;
  return Math.max(1, Math.round((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

function formatGbp(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `£${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Loadable<T> =
  | { state: "loading" }
  | { state: "ready"; value: T }
  | { state: "error"; message: string };

function loading<T>(): Loadable<T> {
  return { state: "loading" };
}

export default function SmtReportingPage() {
  const defaults = getDefaultRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);

  const [actions, setActions] = useState<Loadable<ConversionAction[]>>(loading());
  const [organic, setOrganic] = useState<Loadable<number>>(loading());
  const [homeVisits, setHomeVisits] = useState<Loadable<number>>(loading());
  const [cancellations, setCancellations] = useState<Loadable<number>>(loading());
  const [quotesSent, setQuotesSent] = useState<Loadable<number>>(loading());
  const [timing, setTiming] = useState<
    Loadable<{ avgDays: number | null; sample: number }>
  >(loading());

  const [users, setUsers] = useState<Loadable<number>>(loading());
  const [reviews, setReviews] = useState<
    Loadable<{
      platforms: { name: string; rating: number; increase: number | null }[];
    }>
  >(loading());
  const [visitsCompleted, setVisitsCompleted] = useState<Loadable<number>>(loading());
  const [jobsSold, setJobsSold] = useState<
    Loadable<{ total: number; totalValue: number; avgValue: number }>
  >(loading());
  const [tvMonthly, setTvMonthly] = useState<Loadable<number>>(loading());
  const [editingTv, setEditingTv] = useState(false);
  const [tvInput, setTvInput] = useState("");
  const [savingTv, setSavingTv] = useState(false);
  const [manual, setManual] = useState<ManualSpend>({ google: 0, bing: 0, meta: 0, reddit: 0 });

  // Load TV monthly amount once
  useEffect(() => {
    let cancelled = false;
    fetch("/api/smt-spend-settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { tvMonthlySpend?: number }) => {
        if (!cancelled) setTvMonthly({ state: "ready", value: d.tvMonthlySpend ?? 24600 });
      })
      .catch(() => {
        if (!cancelled) setTvMonthly({ state: "error", message: "Failed to load TV settings" });
      });
    return () => { cancelled = true; };
  }, []);

  // Reload manual spend when range changes
  useEffect(() => {
    setManual(loadManualSpend(from, to));
  }, [from, to]);

  function updateManual(platform: ManualPlatform, value: number) {
    setManual((prev) => {
      const next = { ...prev, [platform]: value };
      saveManualSpend(from, to, next);
      return next;
    });
  }

  async function saveTvMonthly() {
    const value = parseFloat(tvInput);
    if (!Number.isFinite(value) || value < 0) {
      setEditingTv(false);
      return;
    }
    setSavingTv(true);
    try {
      const res = await fetch("/api/smt-spend-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tvMonthlySpend: value }),
      });
      if (res.ok) {
        const d = (await res.json()) as { tvMonthlySpend?: number };
        setTvMonthly({ state: "ready", value: d.tvMonthlySpend ?? value });
        setEditingTv(false);
      }
    } finally {
      setSavingTv(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setActions(loading());
    setOrganic(loading());
    setHomeVisits(loading());
    setCancellations(loading());
    setQuotesSent(loading());
    setTiming(loading());
    setUsers(loading());
    setReviews(loading());
    setVisitsCompleted(loading());
    setJobsSold(loading());

    const set =
      <T,>(setter: React.Dispatch<React.SetStateAction<Loadable<T>>>) =>
      (value: T) => {
        if (!cancelled) setter({ state: "ready", value });
      };
    const fail =
      <T,>(setter: React.Dispatch<React.SetStateAction<Loadable<T>>>, message: string) =>
      () => {
        if (!cancelled) setter({ state: "error", message });
      };

    fetch(`/api/hubspot/conversion-actions?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { actions?: ConversionAction[] }) => set<ConversionAction[]>(setActions)(d.actions ?? []))
      .catch(fail<ConversionAction[]>(setActions, "Failed to load conversion actions"));

    fetch(`/api/hubspot/organic-leads?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { total?: number }) => set<number>(setOrganic)(d.total ?? 0))
      .catch(fail<number>(setOrganic, "Failed to load organic leads"));

    fetch(`/api/hubspot/home-visits?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { total?: number }) => set<number>(setHomeVisits)(d.total ?? 0))
      .catch(fail<number>(setHomeVisits, "Failed to load home visits"));

    fetch(`/api/hubspot/visits-cancelled?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j?.error))))
      .then((d: { total?: number }) => set<number>(setCancellations)(d.total ?? 0))
      .catch((e: unknown) =>
        fail<number>(setCancellations, typeof e === "string" ? e : "Failed to load cancellations")(),
      );

    fetch(`/api/hubspot/quotes-sent?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j?.error))))
      .then((d: { total?: number }) => set<number>(setQuotesSent)(d.total ?? 0))
      .catch((e: unknown) =>
        fail<number>(setQuotesSent, typeof e === "string" ? e : "Failed to load quotes sent")(),
      );

    fetch(`/api/hubspot/visits-completed?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { total?: number }) => set<number>(setVisitsCompleted)(d.total ?? 0))
      .catch(fail<number>(setVisitsCompleted, "Failed to load visits completed"));

    fetch(`/api/hubspot/jobs-sold?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j?.error))))
      .then((d: { total?: number; totalValue?: number; avgValue?: number }) =>
        set<{ total: number; totalValue: number; avgValue: number }>(setJobsSold)({
          total: d.total ?? 0,
          totalValue: d.totalValue ?? 0,
          avgValue: d.avgValue ?? 0,
        }),
      )
      .catch((e: unknown) =>
        fail<{ total: number; totalValue: number; avgValue: number }>(
          setJobsSold,
          typeof e === "string" ? e : "Failed to load jobs sold",
        )(),
      );

    fetch(`/api/reviews?from=${from}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { platforms?: { name: string; rating: number; increase: number | null }[] }) =>
        set<{ platforms: { name: string; rating: number; increase: number | null }[] }>(setReviews)({
          platforms: d.platforms ?? [],
        }),
      )
      .catch(
        fail<{ platforms: { name: string; rating: number; increase: number | null }[] }>(
          setReviews,
          "Failed to load reviews",
        ),
      );

    fetch(`/api/ga/active-users?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { activeUsers?: number }) => set<number>(setUsers)(d.activeUsers ?? 0))
      .catch(fail<number>(setUsers, "Failed to load Google Analytics users"));

    fetch(`/api/hubspot/funnel-timing?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { leadToVisit?: { avgDays: number | null; sample: number } }) =>
        set<{ avgDays: number | null; sample: number }>(setTiming)(
          d.leadToVisit ?? { avgDays: null, sample: 0 },
        ),
      )
      .catch(fail<{ avgDays: number | null; sample: number }>(setTiming, "Failed to load timing"));

    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const totalLeads: Loadable<number> = useMemo(() => {
    if (actions.state !== "ready" || organic.state !== "ready") {
      if (actions.state === "error") return { state: "error", message: actions.message };
      if (organic.state === "error") return { state: "error", message: organic.message };
      return loading();
    }
    const formLeads = actions.value
      .filter((a) => LEAD_ACTIONS.has(a.value))
      .reduce((s, a) => s + a.count, 0);
    return { state: "ready", value: formLeads + organic.value };
  }, [actions, organic]);

  const totalProspects: Loadable<number> = useMemo(() => {
    if (actions.state !== "ready") {
      if (actions.state === "error") return { state: "error", message: actions.message };
      return loading();
    }
    const total = actions.value
      .filter((a) => PROSPECT_ACTIONS.has(a.value))
      .reduce((s, a) => s + a.count, 0);
    return { state: "ready", value: total };
  }, [actions]);

  const webConversionRate: Loadable<number> = useMemo(() => {
    if (totalLeads.state !== "ready" || totalProspects.state !== "ready" || users.state !== "ready") {
      if (totalLeads.state === "error") return totalLeads;
      if (totalProspects.state === "error") return totalProspects;
      if (users.state === "error") return users;
      return loading();
    }
    if (users.value === 0) return { state: "ready", value: 0 };
    return { state: "ready", value: ((totalLeads.value + totalProspects.value) / users.value) * 100 };
  }, [totalLeads, totalProspects, users]);

  const conversionRate: Loadable<number> = useMemo(() => {
    if (totalLeads.state !== "ready" || homeVisits.state !== "ready") {
      if (totalLeads.state === "error") return totalLeads;
      if (homeVisits.state === "error") return homeVisits;
      return loading();
    }
    if (totalLeads.value === 0) return { state: "ready", value: 0 };
    return { state: "ready", value: (homeVisits.value / totalLeads.value) * 100 };
  }, [totalLeads, homeVisits]);

  // ── Spend ──────────────────────────────────────────────────────────────
  const days = useMemo(() => rangeDays(from, to), [from, to]);

  const tvSpend: Loadable<number> = useMemo(() => {
    if (tvMonthly.state !== "ready") return tvMonthly;
    return { state: "ready", value: (tvMonthly.value / 30.44) * days };
  }, [tvMonthly, days]);

  const manualTotal = manual.google + manual.bing + manual.meta + manual.reddit;

  const totalSpend: Loadable<number> = useMemo(() => {
    if (tvSpend.state !== "ready") return tvSpend;
    return { state: "ready", value: tvSpend.value + manualTotal };
  }, [tvSpend, manualTotal]);

  const externalConversion: Loadable<number> = useMemo(() => {
    if (visitsCompleted.state !== "ready" || jobsSold.state !== "ready") {
      if (visitsCompleted.state === "error") return visitsCompleted;
      if (jobsSold.state === "error") return { state: "error", message: jobsSold.message };
      return loading();
    }
    if (visitsCompleted.value === 0) return { state: "ready", value: 0 };
    return { state: "ready", value: (jobsSold.value.total / visitsCompleted.value) * 100 };
  }, [visitsCompleted, jobsSold]);

  const reviewIncrease = useMemo(() => {
    function find(name: string): Loadable<number | null> {
      if (reviews.state !== "ready") return reviews as Loadable<number | null>;
      const p = reviews.value.platforms.find(
        (x) => x.name.toLowerCase().replace(/[\s.]/g, "") === name.toLowerCase().replace(/[\s.]/g, ""),
      );
      if (!p) return { state: "ready", value: 0 };
      return { state: "ready", value: p.increase };
    }
    return {
      trustpilot: find("Trustpilot"),
      reviewsio: find("Reviews.io"),
      google: find("Google"),
      facebook: find("Facebook"),
    };
  }, [reviews]);

  const lowestRating: Loadable<{ rating: number; platform: string } | null> = useMemo(() => {
    if (reviews.state !== "ready") return reviews;
    const rated = reviews.value.platforms.filter((p) => p.rating > 0);
    if (rated.length === 0) return { state: "ready", value: null };
    const min = rated.reduce((a, b) => (a.rating <= b.rating ? a : b));
    return { state: "ready", value: { rating: min.rating, platform: min.name } };
  }, [reviews]);

  const costPerLead: Loadable<number | null> = useMemo(() => {
    if (totalLeads.state !== "ready" || totalSpend.state !== "ready") {
      if (totalLeads.state === "error") return { state: "error", message: totalLeads.message };
      if (totalSpend.state === "error") return totalSpend;
      return loading();
    }
    if (totalLeads.value === 0 || totalSpend.value === 0) return { state: "ready", value: null };
    return { state: "ready", value: totalSpend.value / totalLeads.value };
  }, [totalLeads, totalSpend]);

  /* ── Quick-range presets (matches funnel page) ── */
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

  return (
    <div style={{ padding: "16px 20px 20px", maxWidth: 1700, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
            SMT Reporting
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", gap: "1px", background: "rgba(0,0,0,0.04)", borderRadius: "6px", padding: "2px" }}>
            {ranges.map((r) => {
              const active = from === r.from && to === r.to;
              return (
                <button
                  key={r.label}
                  onClick={() => { setFrom(r.from); setTo(r.to); }}
                  style={{
                    fontSize: "10px",
                    fontWeight: active ? 600 : 400,
                    color: active ? "white" : "var(--color-text-secondary)",
                    background: active ? "var(--color-accent)" : "transparent",
                    border: "none",
                    borderRadius: "4px",
                    padding: "3px 8px",
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
          <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(0,0,0,0.04)", borderRadius: "6px", padding: "3px 8px" }}>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: "10px", color: "var(--color-text-primary)", outline: "none", fontFamily: "inherit" }}
            />
            <span style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}>→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: "10px", color: "var(--color-text-primary)", outline: "none", fontFamily: "inherit" }}
            />
          </div>
        </div>
      </div>

      <Section title="Marketing" accent="#0071E3">
        <SubSection title="Summary">
          <KpiGrid columns="repeat(3, minmax(0, 1fr))">
            <KpiCard
              label="Total Leads"
              value={totalLeads}
              format={(v) => v.toLocaleString()}
              size="hero"
            />
            <KpiCard
              label="Total Prospects"
              value={totalProspects}
              format={(v) => v.toLocaleString()}
              size="hero"
            />
            <KpiCard
              label="Cost Per Lead"
              value={costPerLead}
              format={(v) => (v == null ? "—" : formatGbp(v))}
              subtitle="Total spend ÷ Total Leads"
              size="hero"
            />
          </KpiGrid>
        </SubSection>

        <SubSection title="Web / SEO">
          <KpiGrid>
            <KpiCard
              label="Users"
              value={users}
              format={(v) => v.toLocaleString()}
              subtitle="Active users (Google Analytics)"
            />
            <KpiCard
              label="Web Conversion Rate"
              value={webConversionRate}
              format={(v) => `${v.toFixed(2)}%`}
              subtitle="(Prospects + Leads) ÷ Users"
            />
          </KpiGrid>
        </SubSection>

      </Section>

      <Row>
      <Section title="Spend" accent="#F59E0B" grow>
        <KpiGrid>
          <SpendCard
            label="TV Advert (Sky)"
            amount={tvSpend.state === "ready" ? tvSpend.value : null}
            loading={tvSpend.state === "loading"}
            error={tvSpend.state === "error" ? tvSpend.message : undefined}
            footer={
              <TvFooter
                tvMonthly={tvMonthly}
                editing={editingTv}
                input={tvInput}
                saving={savingTv}
                onStartEdit={() => {
                  if (tvMonthly.state === "ready") {
                    setTvInput(String(tvMonthly.value));
                    setEditingTv(true);
                  }
                }}
                onChangeInput={setTvInput}
                onSave={saveTvMonthly}
                onCancel={() => setEditingTv(false)}
                days={days}
              />
            }
          />
          {MANUAL_PLATFORMS.map((p) => (
            <SpendCard
              key={p}
              label={MANUAL_LABELS[p]}
              amount={manual[p]}
              loading={false}
              footer={
                <ManualSpendInput
                  value={manual[p]}
                  onChange={(v) => updateManual(p, v)}
                />
              }
            />
          ))}
        </KpiGrid>
      </Section>

      <Section title="Reviews Increase" accent="#10B981" grow>
        <KpiGrid>
          <KpiCard
            label="Trustpilot"
            value={reviewIncrease.trustpilot}
            format={(v) => (v == null ? "—" : v.toLocaleString())}
            subtitle="New in period"
          />
          <KpiCard
            label="Reviews.io"
            value={reviewIncrease.reviewsio}
            format={(v) => (v == null ? "—" : v.toLocaleString())}
            subtitle="New in period"
          />
          <KpiCard
            label="Google"
            value={reviewIncrease.google}
            format={(v) => (v == null ? "—" : v.toLocaleString())}
            subtitle="New in period"
          />
          <KpiCard
            label="Facebook"
            value={reviewIncrease.facebook}
            format={(v) => (v == null ? "—" : v.toLocaleString())}
            subtitle="New in period"
          />
          <KpiCard
            label="Lowest Rating"
            value={lowestRating}
            format={(v) => (v == null ? "—" : v.rating.toFixed(1))}
            subtitle={
              lowestRating.state === "ready" && lowestRating.value
                ? `${lowestRating.value.platform} (worst across sites)`
                : "Worst rating across sites"
            }
          />
        </KpiGrid>
      </Section>
      </Row>

      <Row>
      <Section title="Internal Sales" accent="#8B5CF6" grow>
        <KpiGrid>
          <KpiCard
            label="Total Leads"
            value={totalLeads}
            format={(v) => v.toLocaleString()}
          />
          <KpiCard
            label="Home Visit Conversion"
            value={conversionRate}
            format={(v) => `${v.toFixed(1)}%`}
            subtitle="Lead → Home Visit"
          />
          <KpiCard
            label="Home Visits Booked"
            value={homeVisits}
            format={(v) => v.toLocaleString()}
            subtitle="Booked in period"
          />
          <KpiCard
            label="Home Visits Cancelled"
            value={cancellations}
            format={(v) => v.toLocaleString()}
            subtitle="Set to cancelled in period"
          />
          <KpiCard
            label="Design / Quotes Sent"
            value={quotesSent}
            format={(v) => v.toLocaleString()}
            subtitle="Deals into Stage 2 - Quote & Design Sent"
          />
          <KpiCard
            label="Avg Days: Lead → Visit"
            value={timing}
            format={(v) => (v.avgDays == null ? "—" : `${v.avgDays.toFixed(1)} days`)}
            subtitle={
              timing.state === "ready" && timing.value.sample > 0
                ? `n = ${timing.value.sample}`
                : undefined
            }
          />
        </KpiGrid>
      </Section>

      <Section title="External Sales" accent="#0891B2" grow>
        <KpiGrid>
          <KpiCard
            label="Home Visits Completed"
            value={visitsCompleted}
            format={(v) => v.toLocaleString()}
            subtitle="Visit date in period, not cancelled"
          />
          <KpiCard
            label="Conversion Rate"
            value={externalConversion}
            format={(v) => `${v.toFixed(1)}%`}
            subtitle="Visits Completed → Jobs Sold"
          />
          <KpiCard
            label="Jobs Sold"
            value={jobsSold}
            format={(v) => v.total.toLocaleString()}
            subtitle="Deals into Won - Awaiting Install"
          />
          <KpiCard
            label="Total Sold Value"
            value={jobsSold}
            format={(v) => formatGbp(v.totalValue)}
            subtitle="Sum of deal amounts"
          />
          <KpiCard
            label="Average Sold Value"
            value={jobsSold}
            format={(v) => (v.total === 0 ? "—" : formatGbp(v.avgValue))}
            subtitle="Per won job"
          />
        </KpiGrid>
      </Section>
      </Row>
    </div>
  );
}

function SpendCard({
  label,
  amount,
  loading: isLoading,
  error,
  footer,
}: {
  label: string;
  amount: number | null;
  loading: boolean;
  error?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#FAFAFA",
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--color-text-tertiary)",
          margin: 0,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          lineHeight: 1.2,
        }}
      >
        {label}
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        {isLoading && <Skeleton />}
        {error && (
          <span title={error} style={{ fontSize: 11, color: "#B91C1C", fontWeight: 500 }}>
            Error
          </span>
        )}
        {!isLoading && !error && amount !== null && (
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatGbp(amount)}
          </span>
        )}
      </div>
      {footer}
    </div>
  );
}

function TvFooter({
  tvMonthly,
  editing,
  input,
  saving,
  onStartEdit,
  onChangeInput,
  onSave,
  onCancel,
  days,
}: {
  tvMonthly: Loadable<number>;
  editing: boolean;
  input: string;
  saving: boolean;
  onStartEdit: () => void;
  onChangeInput: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  days: number;
}) {
  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 9, color: "var(--color-text-tertiary)" }}>£</span>
        <input
          type="number"
          inputMode="decimal"
          autoFocus
          value={input}
          onChange={(e) => onChangeInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
          style={{
            width: 70,
            fontSize: 10,
            padding: "2px 4px",
            border: "1px solid var(--color-border, #E5E7EB)",
            borderRadius: 4,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            fontSize: 9, padding: "2px 6px", borderRadius: 4, border: "none",
            background: "var(--color-accent)", color: "white", cursor: saving ? "wait" : "pointer", fontFamily: "inherit",
          }}
        >
          {saving ? "…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            fontSize: 9, padding: "2px 4px", borderRadius: 4, border: "none",
            background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          ✕
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "var(--color-text-tertiary)", lineHeight: 1.2 }}>
      <span>
        {tvMonthly.state === "ready"
          ? `${formatGbp(tvMonthly.value)}/mo · ${days}d`
          : tvMonthly.state === "error"
            ? "—"
            : "…"}
      </span>
      {tvMonthly.state === "ready" && (
        <button
          onClick={onStartEdit}
          style={{
            fontSize: 9, padding: 0, border: "none", background: "transparent",
            color: "var(--color-accent)", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline",
          }}
        >
          edit
        </button>
      )}
    </div>
  );
}

function ManualSpendInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 9, color: "var(--color-text-tertiary)" }}>£</span>
      <input
        type="number"
        inputMode="decimal"
        value={value === 0 ? "" : value}
        placeholder="enter spend"
        onChange={(e) => {
          const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
          onChange(Number.isFinite(v) ? v : 0);
        }}
        style={{
          width: "100%",
          minWidth: 0,
          fontSize: 10,
          padding: "2px 4px",
          border: "1px solid var(--color-border, #E5E7EB)",
          borderRadius: 4,
          outline: "none",
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "stretch" }}>
      {children}
    </div>
  );
}

function Section({
  title,
  children,
  accent = "#0071E3",
  grow = false,
}: {
  title: string;
  children: React.ReactNode;
  accent?: string;
  grow?: boolean;
}) {
  return (
    <section
      style={{
        background: "#FFFFFF",
        borderRadius: 14,
        padding: "12px 14px",
        marginBottom: grow ? 0 : 12,
        flex: grow ? 1 : undefined,
        minWidth: 0,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
        border: "1px solid rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h2
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-text-secondary)",
          margin: "0 0 10px",
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: 2,
            background: accent,
          }}
        />
        {title}
      </h2>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-text-tertiary)",
          margin: "0 0 6px",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function KpiGrid({ children, columns }: { children: React.ReactNode; columns?: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: columns ?? "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}

function KpiCard<T>({
  label,
  value,
  format,
  subtitle,
  size,
}: {
  label: string;
  value: Loadable<T>;
  format: (v: T) => string;
  subtitle?: string;
  size?: "default" | "hero";
}) {
  const isHero = size === "hero";
  return (
    <div
      style={{
        background: isHero
          ? "linear-gradient(135deg, #FAFAFC 0%, #F4F5F8 100%)"
          : "#FAFAFA",
        borderRadius: 10,
        padding: isHero ? "12px 14px" : "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--color-text-tertiary)",
          margin: 0,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          lineHeight: 1.2,
        }}
      >
        {label}
      </p>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        {value.state === "loading" && <Skeleton />}
        {value.state === "error" && (
          <span
            title={value.message}
            style={{ fontSize: 11, color: "#B91C1C", fontWeight: 500 }}
          >
            Error
          </span>
        )}
        {value.state === "ready" && (
          <span
            style={{
              fontSize: isHero ? 28 : 20,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {format(value.value)}
          </span>
        )}
      </div>

      {subtitle && value.state !== "error" && (
        <p
          style={{
            fontSize: 9,
            color: "var(--color-text-tertiary)",
            fontWeight: 400,
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {subtitle}
        </p>
      )}
      {value.state === "error" && (
        <p
          style={{
            fontSize: 9,
            color: "#B91C1C",
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {value.message}
        </p>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <span
      aria-label="Loading"
      style={{
        display: "inline-block",
        height: 22,
        width: 70,
        borderRadius: 6,
        background: "rgba(0,0,0,0.06)",
      }}
    />
  );
}
