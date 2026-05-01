"use client";

import Link from "next/link";
import KpiTile from "../components/KpiTile";
import { MonthlyTargets, TeamRace, ContactsTrend } from "../components/DashboardStats";
import {
  MyTasks,
  OutstandingApprovals,
  ContentToCheck,
  LatestMeetingNotes,
  LatestTeamChanges,
  ReviewSummary,
  ChannelPerformance,
  ConversionFunnel,
  ThisWeeksContent,
  OutreachFeedbackSummary,
  LifecycleBreakdown,
  PipelineValue,
} from "./_dashboard-widgets";

function currentMonthRange() {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: fmt(monthStart), to: fmt(now), monthLabel: now.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) };
}

const PROSPECT_ACTIONS = ["Brochure Download Form", "Flipbook Form", "VAT Exempt Checker", "Pricing Guide", "Physical Brochure Request", "Newsletter Sign Up"];
const LEAD_ACTIONS = ["Brochure - Call Me", "Request A Callback Form", "Contact Form", "Free Home Design Form", "Phone Call", "Walk In Bath Form", "Direct Email", "Brochure - Home Visit", "Pricing Guide Home Visit"];

function gbp(v: number | string): string {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return `£${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `£${Math.round(n).toLocaleString()}`;
}

const QUICK_LINKS: { group: string; items: { href: string; label: string }[] }[] = [
  {
    group: "Tasks & notes",
    items: [
      { href: "/workspace", label: "Tasks" },
      { href: "/notes", label: "Meeting Notes" },
    ],
  },
  {
    group: "Analytics & Reporting",
    items: [
      { href: "/funnel", label: "Customer Funnel" },
      { href: "/teams", label: "Contacts Per Team" },
      { href: "/trends", label: "Trends & Lifecycle" },
      { href: "/lead-timeline", label: "Lead Timeline" },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/site-visits", label: "Site Visits" },
      { href: "/installs", label: "Installs" },
      { href: "/team-changes", label: "Team Changes" },
      { href: "/financial-approvals", label: "Financial Approvals" },
    ],
  },
  {
    group: "Marketing & CRM",
    items: [
      { href: "/content-calendar", label: "Content Calendar" },
      { href: "/automation-map", label: "Journeys & Automations" },
      { href: "/feedback", label: "Outreach Feedback" },
      { href: "/reviews-social", label: "Reviews & Social" },
      { href: "/subscriptions", label: "Subscriptions" },
    ],
  },
  {
    group: "Admin",
    items: [
      { href: "/settings", label: "Settings" },
      { href: "/users", label: "Users" },
      { href: "/overview", label: "Full Overview" },
    ],
  },
];

export default function DashboardPage() {
  const { from, to, monthLabel } = currentMonthRange();

  return (
    <div style={{ padding: "28px 28px 48px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
            Dashboard
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
            Overview for {monthLabel}. Click any card to dig in.
          </p>
        </div>
        <Link
          href="/overview"
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--color-accent)",
            textDecoration: "none",
            background: "rgba(0,113,227,0.08)",
            padding: "8px 14px",
            borderRadius: "var(--radius-pill)",
          }}
        >
          Full overview →
        </Link>
      </div>

      {/* Action items: things that need attention */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <MyTasks />
        <OutstandingApprovals />
        <ContentToCheck />
      </div>

      {/* Activity & references */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 14,
          marginBottom: 28,
        }}
      >
        <LatestMeetingNotes />
        <LatestTeamChanges />
        <ReviewSummary />
      </div>

      {/* Performance & funnel insights */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
        Performance
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 14,
          marginBottom: 28,
        }}
      >
        <ChannelPerformance />
        <ConversionFunnel />
        <LifecycleBreakdown />
        <PipelineValue />
        <OutreachFeedbackSummary />
        <ThisWeeksContent />
      </div>

      {/* KPI tiles */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
        This month at a glance
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 14,
        }}
      >
        <KpiTile
          label="Live visitors"
          href="/trends"
          fetchUrl="/api/ga/realtime"
          extract={(d) => (d as { activeNow?: number } | null)?.activeNow ?? null}
          subtitle="Right now on acb.co.uk"
          accent="#30A46C"
        />
        <KpiTile
          label="Contacts"
          href="/funnel"
          fetchUrl={`/api/hubspot/contacts-created?from=${from}&to=${to}`}
          extract={(d) => (d as { total?: number } | null)?.total ?? null}
          subtitle="New this month"
          accent="#0071E3"
        />
        <KpiTile
          label="Prospects"
          href="/funnel"
          fetchUrl={`/api/hubspot/conversion-actions?from=${from}&to=${to}`}
          extract={(d) => {
            const actions = (d as { actions?: { value: string; count: number }[] } | null)?.actions ?? [];
            return actions.filter((a) => PROSPECT_ACTIONS.includes(a.value)).reduce((s, a) => s + a.count, 0);
          }}
          subtitle="Low-intent enquiries"
          accent="#E8833A"
        />
        <KpiTile
          label="Leads"
          href="/funnel"
          fetchUrl={`/api/hubspot/conversion-actions?from=${from}&to=${to}`}
          extract={(d) => {
            const actions = (d as { actions?: { value: string; count: number }[] } | null)?.actions ?? [];
            return actions.filter((a) => LEAD_ACTIONS.includes(a.value)).reduce((s, a) => s + a.count, 0);
          }}
          subtitle="High-intent enquiries"
          accent="#8E4EC6"
        />
        <KpiTile
          label="Site visits"
          href="/site-visits"
          fetchUrl={`/api/hubspot/site-visits?from=${from}&to=${to}`}
          extract={(d) => (d as { inPeriod?: number } | null)?.inPeriod ?? null}
          subtitle="Home visits this month"
          accent="#D93D42"
        />
        <KpiTile
          label="Installs"
          href="/installs"
          fetchUrl={`/api/hubspot/installs?from=${from}&to=${to}`}
          extract={(d) => {
            const months = (d as { months?: { key: string; count: number }[] } | null)?.months ?? [];
            const thisMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
            return months.find((m) => m.key === thisMonthKey)?.count ?? 0;
          }}
          subtitle="Completed this month"
          accent="#30A46C"
        />
        <KpiTile
          label="Won jobs"
          href="/funnel"
          fetchUrl={`/api/hubspot/won-deals?from=${from}&to=${to}`}
          extract={(d) => (d as { total?: number } | null)?.total ?? null}
          subtitle="Closed / won this month"
          accent="#0071E3"
        />
        <KpiTile
          label="Won value"
          href="/funnel"
          fetchUrl={`/api/hubspot/won-deals?from=${from}&to=${to}`}
          extract={(d) => (d as { totalValue?: number } | null)?.totalValue ?? null}
          format={gbp}
          subtitle="Revenue booked this month"
          accent="#8E4EC6"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14, marginTop: 22 }}>
        <MonthlyTargets />
        <TeamRace />
      </div>

      <div style={{ marginTop: 14 }}>
        <ContactsTrend />
      </div>

      {/* Quick links to every other page in the portal */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Quick links
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {QUICK_LINKS.map((g) => (
            <div
              key={g.group}
              style={{
                background: "var(--bg-card)",
                borderRadius: 14,
                boxShadow: "var(--shadow-card)",
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                {g.group}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {g.items.map((q) => (
                  <Link
                    key={q.href}
                    href={q.href}
                    style={{
                      display: "block",
                      padding: "6px 8px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                      textDecoration: "none",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.035)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {q.label} →
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
