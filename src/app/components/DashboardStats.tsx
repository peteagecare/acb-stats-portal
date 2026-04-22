"use client";

import { useEffect, useState } from "react";

/* ── Shared helpers ── */

const PROSPECT_ACTIONS = ["Brochure Download Form", "Flipbook Form", "VAT Exempt Checker", "Pricing Guide", "Physical Brochure Request", "Newsletter Sign Up"];
const LEAD_ACTIONS = ["Brochure - Call Me", "Request A Callback Form", "Contact Form", "Free Home Design Form", "Phone Call", "Walk In Bath Form", "Direct Email", "Brochure - Home Visit", "Pricing Guide Home Visit"];

const REDISTRIBUTED_SOURCES = new Set(["Direct", "Phone Call", "(No value)", "__no_value__"]);

interface Goals {
  contactsGoalPerMonth: number | null;
  leadGoalPerMonth: number | null;
  prospectsGoalPerMonth: number | null;
  visitsGoalPerMonth: number | null;
  installsGoalPerMonth: number | null;
  ppcGoalPerMonth: number | null;
  seoGoalPerMonth: number | null;
  contentGoalPerMonth: number | null;
  tvGoalPerMonth: number | null;
  ppcPercentGoal: number | null;
  seoPercentGoal: number | null;
  contentPercentGoal: number | null;
  tvPercentGoal: number | null;
}

function currentMonthInfo() {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const dayOfMonth = now.getDate();
  const fraction = Math.min(dayOfMonth / daysInMonth, 1);
  return { from: fmt(monthStart), to: fmt(now), daysInMonth, dayOfMonth, fraction, monthKey: `${now.getFullYear()}-${pad(now.getMonth() + 1)}` };
}

function statusColour(current: number, expected: number): { fill: string; text: string; bg: string; label: string } {
  if (expected <= 0) return { fill: "#30A46C", text: "#107A3E", bg: "#E3F5EA", label: "—" };
  const ratio = current / expected;
  if (ratio >= 1.0) return { fill: "#30A46C", text: "#107A3E", bg: "#E3F5EA", label: "Ahead" };
  if (ratio >= 0.9) return { fill: "#E8A33A", text: "#9A6B1F", bg: "#FFF4DE", label: "On track" };
  return { fill: "#D93D42", text: "#9E1A1E", bg: "#FCE6E7", label: "Behind" };
}

function Skeleton({ height = 20 }: { height?: number }) {
  return <div style={{ height, borderRadius: 6, background: "rgba(0,0,0,0.06)", animation: "pulse 1.6s ease-in-out infinite" }} />;
}

/* ── Monthly Targets strip ── */

type TargetRow = {
  label: string;
  current: number;
  target: number | null;
};

export function MonthlyTargets() {
  const { from, to, daysInMonth, dayOfMonth, fraction, monthKey } = currentMonthInfo();
  const [goals, setGoals] = useState<Goals | null>(null);
  const [contacts, setContacts] = useState<number | null>(null);
  const [conversionActions, setConversionActions] = useState<{ value: string; count: number }[] | null>(null);
  const [homeVisits, setHomeVisits] = useState<number | null>(null);
  const [installsCount, setInstallsCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/goals").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setGoals(d); }).catch(() => {});
    fetch(`/api/hubspot/contacts-created?from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : null)).then((d) => setContacts(d?.total ?? 0)).catch(() => {});
    fetch(`/api/hubspot/conversion-actions?from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : null)).then((d) => setConversionActions(d?.actions ?? [])).catch(() => {});
    fetch(`/api/hubspot/home-visits?from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : null)).then((d) => setHomeVisits(d?.total ?? d?.count ?? 0)).catch(() => {});
    fetch(`/api/hubspot/installs?from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      const thisMonth = (d?.months ?? []).find((m: { key: string; count: number }) => m.key === monthKey);
      setInstallsCount(thisMonth?.count ?? 0);
    }).catch(() => {});
  }, [from, to, monthKey]);

  const prospects = conversionActions
    ? conversionActions.filter((a) => PROSPECT_ACTIONS.includes(a.value)).reduce((s, a) => s + a.count, 0)
    : null;
  const leads = conversionActions
    ? conversionActions.filter((a) => LEAD_ACTIONS.includes(a.value)).reduce((s, a) => s + a.count, 0)
    : null;

  const rows: TargetRow[] = [
    { label: "Contacts", current: contacts ?? 0, target: goals?.contactsGoalPerMonth ?? null },
    { label: "Prospects", current: prospects ?? 0, target: goals?.prospectsGoalPerMonth ?? null },
    { label: "Leads", current: leads ?? 0, target: goals?.leadGoalPerMonth ?? null },
    { label: "Home visits", current: homeVisits ?? 0, target: goals?.visitsGoalPerMonth ?? null },
    { label: "Installs", current: installsCount ?? 0, target: goals?.installsGoalPerMonth ?? null },
  ];

  const allLoaded = goals !== null && contacts !== null && conversionActions !== null && homeVisits !== null && installsCount !== null;

  return (
    <Card
      title="Monthly targets"
      subtitle={`Day ${dayOfMonth} of ${daysInMonth} — you should be around ${Math.round(fraction * 100)}% of target by now.`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.map((row) => (
          <TargetBar
            key={row.label}
            row={row}
            fraction={fraction}
            loaded={allLoaded}
          />
        ))}
      </div>
    </Card>
  );
}

function TargetBar({ row, fraction, loaded }: { row: TargetRow; fraction: number; loaded: boolean }) {
  const target = row.target;
  const hasTarget = target != null && target > 0;
  const expected = hasTarget ? target * fraction : 0;
  const pctOfTarget = hasTarget ? Math.min((row.current / target) * 100, 100) : 0;
  const expectedPct = hasTarget ? Math.min(fraction * 100, 100) : 0;
  const status = hasTarget ? statusColour(row.current, expected) : null;
  const delta = hasTarget ? row.current - Math.round(expected) : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{row.label}</span>
          {!loaded ? (
            <span style={{ display: "inline-block", width: 60, height: 14, borderRadius: 4, background: "rgba(0,0,0,0.06)", animation: "pulse 1.6s ease-in-out infinite" }} />
          ) : (
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {row.current.toLocaleString()}
              {hasTarget ? ` / ${target.toLocaleString()}` : " · no target set"}
            </span>
          )}
        </div>
        {loaded && hasTarget && status && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: status.text,
              background: status.bg,
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            {status.label}
            {delta !== 0 && ` · ${delta > 0 ? "+" : ""}${delta}`}
          </span>
        )}
      </div>

      <div
        style={{
          position: "relative",
          height: 10,
          borderRadius: 6,
          background: "rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}
      >
        {loaded && hasTarget && (
          <>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: `${pctOfTarget}%`,
                background: status?.fill ?? "#AEAEB2",
                transition: "width 300ms var(--ease-apple)",
              }}
            />
            {/* Expected-by-today tick */}
            <div
              style={{
                position: "absolute",
                top: -2,
                bottom: -2,
                left: `${expectedPct}%`,
                width: 2,
                background: "rgba(0,0,0,0.35)",
                transform: "translateX(-50%)",
              }}
              title={`Expected by today: ${Math.round(expected)}`}
            />
          </>
        )}
        {loaded && !hasTarget && (
          <div style={{ height: "100%", background: "repeating-linear-gradient(45deg, rgba(0,0,0,0.04), rgba(0,0,0,0.04) 6px, rgba(0,0,0,0.08) 6px, rgba(0,0,0,0.08) 12px)" }} />
        )}
      </div>
    </div>
  );
}

/* ── Team Race ── */

interface ByCategory {
  total: number;
  sources: { value: string; label: string; count: number }[];
}

const TEAMS: { key: "PPC" | "SEO" | "Content" | "TV"; label: string; colour: string }[] = [
  { key: "PPC", label: "PPC", colour: "#EF4444" },
  { key: "SEO", label: "SEO", colour: "#10B981" },
  { key: "Content", label: "Content", colour: "#8B5CF6" },
  { key: "TV", label: "TV", colour: "#F97316" },
];

export function TeamRace() {
  const { from, to, fraction } = currentMonthInfo();
  const [byCategory, setByCategory] = useState<Record<string, ByCategory> | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);

  useEffect(() => {
    fetch(`/api/hubspot/contacts-by-source?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setByCategory(d?.byCategory ?? null))
      .catch(() => {});
    fetch("/api/goals")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setGoals(d); })
      .catch(() => {});
  }, [from, to]);

  const loaded = byCategory !== null && goals !== null;

  const rows = TEAMS.map((t) => {
    const cats = byCategory;
    const sourcesTotal = cats ? (cats.PPC?.total ?? 0) + (cats.SEO?.total ?? 0) + (cats.Content?.total ?? 0) + (cats.TV?.total ?? 0) + (cats.Other?.total ?? 0) : 0;
    const otherSources = cats?.Other?.sources ?? [];
    const redistTotal = otherSources
      .filter((s) => REDISTRIBUTED_SOURCES.has(s.value) || REDISTRIBUTED_SOURCES.has(s.label))
      .reduce((s, x) => s + x.count, 0);
    const redistPerTeam = Math.round(redistTotal / 3);
    const remainder = redistTotal - redistPerTeam * 3;
    let shared = 0;
    if (t.key === "PPC") shared = redistPerTeam + remainder;
    else if (t.key === "SEO" || t.key === "Content") shared = redistPerTeam;
    const native = cats?.[t.key]?.total ?? 0;
    const total = native + shared;

    // Goal: explicit per-team monthly, OR percent of contactsGoalPerMonth
    const percent = goals ? (t.key === "PPC" ? goals.ppcPercentGoal : t.key === "SEO" ? goals.seoPercentGoal : t.key === "Content" ? goals.contentPercentGoal : goals.tvPercentGoal) : null;
    const explicit = goals ? (t.key === "PPC" ? goals.ppcGoalPerMonth : t.key === "SEO" ? goals.seoGoalPerMonth : t.key === "Content" ? goals.contentGoalPerMonth : goals.tvGoalPerMonth) : null;
    const target =
      percent != null && goals?.contactsGoalPerMonth
        ? Math.round((goals.contactsGoalPerMonth * percent) / 100)
        : explicit ?? null;

    const expected = target ? target * fraction : 0;
    const pctOfTarget = target ? Math.min((total / target) * 100, 100) : 0;
    const status = target && target > 0 ? statusColour(total, expected) : null;
    const share = sourcesTotal > 0 ? (total / sourcesTotal) * 100 : 0;

    return { ...t, total, target, share, pctOfTarget, status, expected, expectedPct: Math.min(fraction * 100, 100) };
  });

  return (
    <Card
      title="Team race"
      subtitle="Contacts by marketing team vs monthly goal — shared numbers (Direct / Phone / unknown) split evenly across PPC, SEO, Content."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((r) => (
          <div key={r.key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: r.colour }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{r.label}</span>
                {!loaded ? (
                  <span style={{ display: "inline-block", width: 60, height: 14, borderRadius: 4, background: "rgba(0,0,0,0.06)", animation: "pulse 1.6s ease-in-out infinite" }} />
                ) : (
                  <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    {r.total.toLocaleString()}
                    {r.target != null ? ` / ${r.target.toLocaleString()}` : ""}
                    {r.share > 0 ? ` · ${r.share.toFixed(0)}% of total` : ""}
                  </span>
                )}
              </div>
              {loaded && r.status && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: r.status.text,
                    background: r.status.bg,
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  {r.status.label}
                </span>
              )}
            </div>
            <div style={{ position: "relative", height: 10, borderRadius: 6, background: "rgba(0,0,0,0.05)", overflow: "hidden" }}>
              {loaded && r.target != null && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: `${r.pctOfTarget}%`,
                      background: r.colour,
                      transition: "width 300ms var(--ease-apple)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: -2,
                      bottom: -2,
                      left: `${r.expectedPct}%`,
                      width: 2,
                      background: "rgba(0,0,0,0.35)",
                      transform: "translateX(-50%)",
                    }}
                    title={`Expected by today: ${Math.round(r.expected)}`}
                  />
                </>
              )}
              {loaded && r.target == null && (
                <div style={{ height: "100%", background: "repeating-linear-gradient(45deg, rgba(0,0,0,0.04), rgba(0,0,0,0.04) 6px, rgba(0,0,0,0.08) 6px, rgba(0,0,0,0.08) 12px)" }} />
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── Contacts trend (last 30 days) ── */

export function ContactsTrend() {
  const [data, setData] = useState<{ label: string; count: number }[] | null>(null);

  useEffect(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 29);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    fetch(`/api/hubspot/contacts-daily?from=${fmt(from)}&to=${fmt(to)}&metric=contacts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d?.data ?? []))
      .catch(() => setData([]));
  }, []);

  const total = data?.reduce((s, d) => s + d.count, 0) ?? 0;
  const max = data && data.length > 0 ? Math.max(...data.map((d) => d.count), 1) : 1;
  const avg = data && data.length > 0 ? total / data.length : 0;

  return (
    <Card
      title="Last 30 days — Contacts"
      subtitle={data ? `${total.toLocaleString()} total · ${avg.toFixed(1)} per day average` : "Loading…"}
    >
      {!data ? (
        <Skeleton height={80} />
      ) : data.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", padding: "20px 0" }}>No data in the last 30 days.</div>
      ) : (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 2,
              height: 80,
              paddingTop: 4,
            }}
          >
            {data.map((d, i) => {
              const pct = (d.count / max) * 100;
              const date = new Date(d.label);
              const weekend = date.getDay() === 0 || date.getDay() === 6;
              return (
                <div
                  key={i}
                  title={`${d.label}: ${d.count}`}
                  style={{
                    flex: 1,
                    height: `${Math.max(pct, 2)}%`,
                    background: weekend ? "rgba(0,113,227,0.35)" : "var(--color-accent)",
                    borderRadius: "3px 3px 0 0",
                    minHeight: 2,
                    transition: "height 300ms var(--ease-apple)",
                  }}
                />
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--color-text-tertiary)",
              marginTop: 6,
            }}
          >
            <span>{data[0]?.label.slice(5) ?? ""}</span>
            <span style={{ color: "var(--color-text-secondary)" }}>Weekends in lighter blue</span>
            <span>{data[data.length - 1]?.label.slice(5) ?? ""}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Shared card wrapper ── */

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        padding: "18px 20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>{title}</h2>
      </div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: -8, marginBottom: 14, lineHeight: 1.4 }}>{subtitle}</div>
      {children}
    </div>
  );
}
