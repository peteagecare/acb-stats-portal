"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  APPROVAL_ROLES,
  AnyApprovalKey,
  isFullyApproved,
  pendingActionsForUser,
} from "@/lib/approval-roles";

const PETE_EMAIL = "pete@agecare-bathrooms.co.uk";

interface MeResp {
  email: string;
  label?: string;
  role?: string;
}

function useMe() {
  const [me, setMe] = useState<MeResp | null>(null);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MeResp | null) => d && setMe(d))
      .catch(() => {});
  }, []);
  return me;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function pad(n: number) { return n.toString().padStart(2, "0"); }
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function rangeLastNDays(n: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - n);
  return { from: isoDay(from), to: isoDay(to) };
}
function thisWeekRange(): { from: string; to: string; days: string[] } {
  const now = new Date();
  const monday = new Date(now);
  const dow = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dow);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const days: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(isoDay(d));
  }
  return { from: isoDay(monday), to: isoDay(friday), days };
}
function fmtGbp(n: number): string {
  if (!Number.isFinite(n)) return "£0";
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `£${(n / 1_000).toFixed(0)}k`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(1)}k`;
  return `£${Math.round(n).toLocaleString()}`;
}

function fmtRelative(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days < -1) return `in ${-days} days`;
  if (days === -1) return "tomorrow";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Widget({
  title,
  action,
  children,
  href,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  href?: string;
}) {
  return (
    <section
      style={{
        background: "var(--bg-card)",
        borderRadius: 18,
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--color-border)" }}>
        {href ? (
          <Link href={href} style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", textDecoration: "none" }}>
            {title}
          </Link>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{title}</span>
        )}
        <div style={{ marginLeft: "auto" }}>{action}</div>
      </header>
      <div style={{ padding: "10px 0", flex: 1 }}>{children}</div>
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "16px 18px", fontSize: 13, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
      {children}
    </div>
  );
}

function ListRow({ children, href }: { children: React.ReactNode; href?: string }) {
  const inner = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 18px",
        borderTop: "1px solid var(--color-border)",
        textDecoration: "none",
        color: "inherit",
        cursor: href ? "pointer" : "default",
      }}
      onMouseEnter={(e) => { if (href) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
      onMouseLeave={(e) => { if (href) e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>{inner}</Link> : inner;
}

/* ─────── My Tasks ─────── */

interface DashTask {
  id: string;
  title: string;
  ownerEmail: string | null;
  endDate: string | null;
  completed: boolean;
  status: string;
  priority: string | null;
  projectId: string;
  projectName: string;
  companyId: string;
  companyName: string;
}

export function MyTasks() {
  const me = useMe();
  const [tasks, setTasks] = useState<DashTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/workspace/dashboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { tasks: [] }))
      .then((d: { tasks: DashTask[] }) => setTasks(d.tasks ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const mine = useMemo(() => {
    if (!me) return [];
    return tasks
      .filter((t) => !t.completed && t.ownerEmail?.toLowerCase() === me.email.toLowerCase())
      .sort((a, b) => {
        const ad = a.endDate ?? "9999-12-31";
        const bd = b.endDate ?? "9999-12-31";
        return ad.localeCompare(bd);
      })
      .slice(0, 8);
  }, [tasks, me]);

  return (
    <Widget title="My tasks" href="/workspace" action={<CountPill n={mine.length} />}>
      {loading && <EmptyState>Loading…</EmptyState>}
      {!loading && mine.length === 0 && <EmptyState>Nothing on your plate. Nice.</EmptyState>}
      {mine.map((t) => {
        const overdue = t.endDate && t.endDate < new Date().toISOString().slice(0, 10);
        return (
          <ListRow key={t.id} href={`/workspace/${t.companyId}/${t.projectId}?task=${t.id}`}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.title}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>
                {t.companyName} · {t.projectName}
              </div>
            </div>
            {t.endDate && (
              <span style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "3px 8px",
                borderRadius: 999,
                background: overdue ? "#fee2e2" : "rgba(0,0,0,0.04)",
                color: overdue ? "#991b1b" : "var(--color-text-secondary)",
                whiteSpace: "nowrap",
              }}>
                {fmtDate(t.endDate)}
              </span>
            )}
          </ListRow>
        );
      })}
    </Widget>
  );
}

/* ─────── Outstanding Approvals ─────── */

interface ContentItem {
  id: string;
  type: "facebook" | "instagram" | "blog";
  title: string;
  url: string;
  submittedBy: string;
}

interface HubSpotEmail {
  id: string;
  name: string;
  subject: string;
}

interface CalEntry {
  id: string;
  title: string;
  liveDate: string;
  platform?: string;
  platforms?: string[];
  needsFinanceApproval: boolean;
  status: string;
  submittedBy: string;
}

function calEntryPlatformLabel(c: CalEntry): string {
  if (Array.isArray(c.platforms) && c.platforms.length) return c.platforms.join(", ");
  return c.platform ?? "";
}

interface ApprovalsMap {
  [id: string]: Record<string, { approved?: boolean; userLabel?: string } | undefined> & {
    rejection?: { byRole: AnyApprovalKey; userLabel: string; note: string };
  };
}

export function OutstandingApprovals() {
  const me = useMe();
  const [emails, setEmails] = useState<HubSpotEmail[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [calendar, setCalendar] = useState<CalEntry[]>([]);
  const [approvals, setApprovals] = useState<ApprovalsMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/hubspot/emails-list", { cache: "no-store" }).then((r) => r.ok ? r.json() : { emails: [] }),
      fetch("/api/content-items", { cache: "no-store" }).then((r) => r.ok ? r.json() : { items: [] }),
      fetch("/api/content-calendar", { cache: "no-store" }).then((r) => r.ok ? r.json() : { items: [] }),
      fetch("/api/approvals", { cache: "no-store" }).then((r) => r.ok ? r.json() : { approvals: {} }),
    ])
      .then(([e, c, cal, a]) => {
        setEmails(e.emails ?? []);
        setContent(c.items ?? []);
        setCalendar((cal.items ?? []).filter((x: CalEntry) => x.needsFinanceApproval));
        setApprovals(a.approvals ?? {});
      })
      .finally(() => setLoading(false));
  }, []);

  const items = useMemo(() => {
    if (!me) return [];
    const myEmail = me.email;
    type Row = {
      id: string;
      title: string;
      kind: string;
      href: string;
      pendingLabel: string;
      mine: boolean;
    };
    const rows: Row[] = [];

    function approvalState(id: string) {
      const rec = approvals[id] ?? {};
      return {
        pete: !!rec.pete?.approved,
        chris: !!rec.chris?.approved,
        sam: !!rec.sam?.approved,
        outside: !!rec.outside?.approved,
        dnna_pete: !!rec.dnna_pete?.approved,
        dnna_chris: !!rec.dnna_chris?.approved,
        rejected: !!rec.rejection,
      };
    }

    function pushRow(id: string, title: string, kind: string, href: string) {
      const state = approvalState(id);
      if (isFullyApproved(state)) return;
      const pending = APPROVAL_ROLES.filter((r) => !state[r.key]);
      const myActions = pendingActionsForUser(myEmail, state);
      rows.push({
        id,
        title,
        kind,
        href,
        pendingLabel: myActions.length ? "You" : pending.map((r) => r.label.split(" (")[0]).join(", "),
        mine: myActions.length > 0,
      });
    }

    for (const e of emails) {
      // Only emails that already have at least one approval record exist in approvals[id].
      // For drafts with no record yet, show only if the user can take the first step (i.e. Pete).
      const hasRecord = !!approvals[e.id];
      const state = approvalState(e.id);
      if (isFullyApproved(state)) continue;
      const myActions = pendingActionsForUser(myEmail, state);
      if (!hasRecord && myActions.length === 0) continue;
      pushRow(e.id, e.subject || e.name, "email", "/financial-approvals");
    }
    for (const c of content) pushRow(c.id, c.title, c.type, "/financial-approvals");
    for (const cal of calendar) pushRow(cal.id, cal.title, calEntryPlatformLabel(cal), "/content-calendar");

    rows.sort((a, b) => Number(b.mine) - Number(a.mine));
    return rows.slice(0, 8);
  }, [emails, content, calendar, approvals, me]);

  const myCount = items.filter((r) => r.mine).length;

  return (
    <Widget
      title="Finance approvals"
      href="/financial-approvals"
      action={myCount > 0 ? <CountPill n={myCount} tone="warn" /> : <CountPill n={items.length} />}
    >
      {loading && <EmptyState>Loading…</EmptyState>}
      {!loading && items.length === 0 && <EmptyState>Nothing waiting on anyone.</EmptyState>}
      {items.map((row) => (
        <ListRow key={row.id} href={row.href}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2, textTransform: "capitalize" }}>{row.kind}</div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999,
            background: row.mine ? "#fef3c7" : "rgba(0,0,0,0.04)",
            color: row.mine ? "#92400e" : "var(--color-text-secondary)",
            whiteSpace: "nowrap",
          }}>
            Waiting on {row.pendingLabel}
          </span>
        </ListRow>
      ))}
    </Widget>
  );
}

/* ─────── Content "To Check" ─────── */

export function ContentToCheck() {
  const me = useMe();
  const [items, setItems] = useState<CalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const isPete = !!me && me.email.toLowerCase() === PETE_EMAIL;

  useEffect(() => {
    if (!isPete) return;
    fetch("/api/content-calendar", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d: { items: CalEntry[] }) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, [isPete]);

  if (me && !isPete) return null;

  const filtered = items
    .filter((i) => i.status === "To Check - Pete")
    .sort((a, b) => a.liveDate.localeCompare(b.liveDate))
    .slice(0, 8);

  return (
    <Widget
      title="Content awaiting your review"
      href="/content-calendar"
      action={<CountPill n={filtered.length} tone={filtered.length > 0 ? "warn" : "default"} />}
    >
      {loading && <EmptyState>Loading…</EmptyState>}
      {!loading && filtered.length === 0 && <EmptyState>All clear.</EmptyState>}
      {filtered.map((entry) => (
        <ListRow key={entry.id} href="/content-calendar">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{calEntryPlatformLabel(entry)}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 999, background: "rgba(0,0,0,0.04)", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
            {fmtDate(entry.liveDate)}
          </span>
        </ListRow>
      ))}
    </Widget>
  );
}

/* ─────── Latest Meeting Notes ─────── */

interface MeetingNote {
  id: string;
  title: string;
  meetingDate: string | null;
  authorEmail: string;
  updatedAt: string;
}

export function LatestMeetingNotes() {
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notes", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : { notes: [] })
      .then((d: { notes: MeetingNote[] }) => setNotes((d.notes ?? []).slice(0, 5)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Widget
      title="Meeting notes"
      href="/notes"
      action={
        <Link
          href="/notes?new=1"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "5px 12px", borderRadius: 999,
            background: "var(--color-accent)", color: "white",
            fontSize: 11, fontWeight: 600, textDecoration: "none",
          }}
        >
          + Start meeting
        </Link>
      }
    >
      {loading && <EmptyState>Loading…</EmptyState>}
      {!loading && notes.length === 0 && <EmptyState>No meeting notes yet.</EmptyState>}
      {notes.map((n) => (
        <ListRow key={n.id} href={`/notes?id=${n.id}`}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {n.title || "Untitled meeting"}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>
              {n.authorEmail.split("@")[0]} · {fmtRelative(n.updatedAt)}
            </div>
          </div>
        </ListRow>
      ))}
    </Widget>
  );
}

/* ─────── Latest Team Changes ─────── */

interface ChartNote {
  id: string;
  date: string;
  text: string;
  author: string;
  createdAt?: string;
}

export function LatestTeamChanges() {
  const [notes, setNotes] = useState<ChartNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/chart-notes", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : { notes: [] })
      .then((d: { notes?: ChartNote[] } | ChartNote[]) => {
        const list = Array.isArray(d) ? d : (d.notes ?? []);
        const sorted = [...list].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, 5);
        setNotes(sorted);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Widget
      title="Team changes"
      href="/team-changes"
      action={
        <Link
          href="/team-changes?new=1"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "5px 12px", borderRadius: 999,
            background: "var(--color-accent)", color: "white",
            fontSize: 11, fontWeight: 600, textDecoration: "none",
          }}
        >
          + Log change
        </Link>
      }
    >
      {loading && <EmptyState>Loading…</EmptyState>}
      {!loading && notes.length === 0 && <EmptyState>No changes logged yet.</EmptyState>}
      {notes.map((n) => (
        <ListRow key={n.id}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {n.text}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>
              {(n.author || "").split("@")[0]} · {fmtDate(n.date)}
            </div>
          </div>
        </ListRow>
      ))}
    </Widget>
  );
}

/* ─────── Reviews ─────── */

interface ReviewPlatform {
  name: string;
  total: number;
  rating: number;
  increase: number | null;
}

export function ReviewSummary() {
  const [platforms, setPlatforms] = useState<ReviewPlatform[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reviews", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : { platforms: [], totalReviews: 0 })
      .then((d: { platforms?: ReviewPlatform[]; totalReviews?: number }) => {
        setPlatforms(d.platforms ?? []);
        setTotalReviews(d.totalReviews ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Widget title="Reviews" href="/reviews-social" action={<CountPill n={totalReviews} />}>
      {loading && <EmptyState>Loading…</EmptyState>}
      {!loading && platforms.length === 0 && <EmptyState>No review data yet.</EmptyState>}
      {platforms.map((p) => {
        const total = typeof p.total === "number" ? p.total : 0;
        return (
          <ListRow key={p.name}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{p.name}</div>
              {typeof p.rating === "number" && p.rating > 0 && (
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>
                  ★ {p.rating.toFixed(1)}
                </div>
              )}
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>
              {total.toLocaleString()}
            </span>
          </ListRow>
        );
      })}
    </Widget>
  );
}

/* ─────── helpers ─────── */

function CountPill({ n, tone = "default" }: { n: number; tone?: "default" | "warn" }) {
  if (n === 0) return null;
  const colors = tone === "warn"
    ? { bg: "#fef3c7", fg: "#92400e" }
    : { bg: "rgba(0,0,0,0.05)", fg: "var(--color-text-secondary)" };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        background: colors.bg,
        color: colors.fg,
      }}
    >
      {n}
    </span>
  );
}

/* ─────── Channel performance ─────── */

interface ContactsBySourceResp {
  byCategory: Record<"PPC" | "SEO" | "Content" | "TV" | "Other", { total: number; sources: { value: string; label: string; count: number }[] }>;
}

const CHANNEL_META: { key: "PPC" | "SEO" | "Content" | "TV" | "Other"; color: string; bg: string }[] = [
  { key: "PPC", color: "#EF4444", bg: "#FEF2F2" },
  { key: "SEO", color: "#10B981", bg: "#ECFDF5" },
  { key: "Content", color: "#8B5CF6", bg: "#F5F3FF" },
  { key: "TV", color: "#F97316", bg: "#FFF7ED" },
  { key: "Other", color: "#64748B", bg: "#F1F5F9" },
];

export function ChannelPerformance() {
  const [byCategory, setByCategory] = useState<ContactsBySourceResp["byCategory"] | null>(null);
  const [loading, setLoading] = useState(true);
  const { from, to } = rangeLastNDays(30);

  useEffect(() => {
    fetch(`/api/hubspot/contacts-by-source?from=${from}&to=${to}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d: ContactsBySourceResp | null) => setByCategory(d?.byCategory ?? null))
      .finally(() => setLoading(false));
  }, [from, to]);

  const max = byCategory
    ? Math.max(...CHANNEL_META.map((c) => byCategory[c.key]?.total ?? 0))
    : 0;
  const total = byCategory
    ? CHANNEL_META.reduce((s, c) => s + (byCategory[c.key]?.total ?? 0), 0)
    : 0;

  return (
    <Widget title="Contacts by channel · 30d" href="/teams" action={<CountPill n={total} />}>
      {loading && <EmptyState>Loading…</EmptyState>}
      {!loading && !byCategory && <EmptyState>HubSpot data unavailable.</EmptyState>}
      {byCategory && CHANNEL_META.map((c) => {
        const count = byCategory[c.key]?.total ?? 0;
        const pct = max > 0 ? (count / max) * 100 : 0;
        return (
          <div key={c.key} style={{ padding: "8px 18px", borderTop: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: c.color }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{c.key}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{count}</span>
            </div>
            <div style={{ height: 5, background: "rgba(0,0,0,0.05)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: c.color, transition: "width 200ms" }} />
            </div>
          </div>
        );
      })}
    </Widget>
  );
}

/* ─────── Conversion funnel rates ─────── */

const PROSPECT_ACTIONS = ["Brochure Download Form", "Flipbook Form", "VAT Exempt Checker", "Pricing Guide", "Physical Brochure Request", "Newsletter Sign Up"];
const LEAD_ACTIONS = ["Brochure - Call Me", "Request A Callback Form", "Contact Form", "Free Home Design Form", "Phone Call", "Walk In Bath Form", "Direct Email", "Brochure - Home Visit", "Pricing Guide Home Visit"];

export function ConversionFunnel() {
  const [counts, setCounts] = useState<{ contacts: number; prospects: number; leads: number; siteVisits: number; won: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const { from, to } = rangeLastNDays(30);

  useEffect(() => {
    Promise.all([
      fetch(`/api/hubspot/contacts-created?from=${from}&to=${to}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/hubspot/conversion-actions?from=${from}&to=${to}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/hubspot/site-visits?from=${from}&to=${to}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/hubspot/won-deals?from=${from}&to=${to}`).then((r) => r.ok ? r.json() : null),
    ])
      .then(([c, ca, sv, wd]) => {
        const actions = (ca?.actions ?? []) as { value: string; count: number }[];
        const prospects = actions.filter((a) => PROSPECT_ACTIONS.includes(a.value)).reduce((s, a) => s + a.count, 0);
        const leads = actions.filter((a) => LEAD_ACTIONS.includes(a.value)).reduce((s, a) => s + a.count, 0);
        setCounts({
          contacts: c?.total ?? 0,
          prospects,
          leads,
          siteVisits: sv?.inPeriod ?? 0,
          won: wd?.total ?? 0,
        });
      })
      .finally(() => setLoading(false));
  }, [from, to]);

  const stages: { label: string; key: keyof NonNullable<typeof counts>; color: string }[] = [
    { label: "Contacts", key: "contacts", color: "#0071E3" },
    { label: "Prospects", key: "prospects", color: "#E8833A" },
    { label: "Leads", key: "leads", color: "#8E4EC6" },
    { label: "Site visits", key: "siteVisits", color: "#D93D42" },
    { label: "Won jobs", key: "won", color: "#30A46C" },
  ];

  return (
    <Widget title="Funnel conversion · 30d" href="/funnel">
      {loading && <EmptyState>Loading…</EmptyState>}
      {!loading && !counts && <EmptyState>HubSpot data unavailable.</EmptyState>}
      {counts && stages.map((s, i) => {
        const value = counts[s.key];
        const prev = i > 0 ? counts[stages[i - 1].key] : null;
        const rate = prev != null && prev > 0 ? (value / prev) * 100 : null;
        const max = counts.contacts || 1;
        const pct = max > 0 ? (value / max) * 100 : 0;
        return (
          <div key={s.key} style={{ padding: "8px 18px", borderTop: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{s.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {rate !== null && (
                  <span style={{ fontSize: 11, color: rate < 25 ? "#b91c1c" : "var(--color-text-tertiary)" }}>
                    {rate.toFixed(0)}%
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{value.toLocaleString()}</span>
              </div>
            </div>
            <div style={{ height: 5, background: "rgba(0,0,0,0.05)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: s.color, transition: "width 200ms" }} />
            </div>
          </div>
        );
      })}
    </Widget>
  );
}

/* ─────── This week's content ─────── */

interface CalEntryWeek {
  id: string;
  title: string;
  liveDate: string;
  time?: string;
  platform?: string;
  platforms?: string[];
  status: string;
  assetLink?: string;
}

const STATUS_BG: Record<string, { bg: string; fg: string }> = {
  "Live": { bg: "#7c3aed", fg: "#fff" },
  "Approved": { bg: "#d1fae5", fg: "#065f46" },
  "Scheduled": { bg: "#e0e7ff", fg: "#3730a3" },
  "Scheduled - Post On The Day": { bg: "#cffafe", fg: "#155e75" },
  "To Check - Pete": { bg: "#fef3c7", fg: "#92400e" },
  "Suggested Changes": { bg: "#fde68a", fg: "#78350f" },
  "In Progress": { bg: "#dbeafe", fg: "#1e40af" },
  "Not Started": { bg: "#e5e7eb", fg: "#374151" },
  "Cancelled": { bg: "#374151", fg: "#fff" },
};

export function ThisWeeksContent() {
  const [items, setItems] = useState<CalEntryWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const { from, to, days } = thisWeekRange();

  useEffect(() => {
    fetch("/api/content-calendar", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d: { items: CalEntryWeek[] }) => {
        const list = (d.items ?? []).filter((i) => i.liveDate >= from && i.liveDate <= to);
        list.sort((a, b) => a.liveDate.localeCompare(b.liveDate) || (a.time ?? "").localeCompare(b.time ?? ""));
        setItems(list);
      })
      .finally(() => setLoading(false));
  }, [from, to]);

  const today = isoDay(new Date());

  return (
    <Widget title="This week's content" href="/content-calendar" action={<CountPill n={items.length} />}>
      {loading && <EmptyState>Loading…</EmptyState>}
      {!loading && items.length === 0 && <EmptyState>Nothing scheduled this week yet.</EmptyState>}
      {days.map((d) => {
        const dayEntries = items.filter((i) => i.liveDate === d);
        if (dayEntries.length === 0) return null;
        const date = new Date(d + "T00:00:00");
        const isToday = d === today;
        return (
          <div key={d} style={{ padding: "8px 18px", borderTop: "1px solid var(--color-border)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? "var(--color-accent)" : "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              {date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}{isToday ? " · today" : ""}
            </div>
            {dayEntries.map((e) => {
              const c = STATUS_BG[e.status] ?? { bg: "rgba(0,0,0,0.05)", fg: "var(--color-text-secondary)" };
              const missingAsset = isToday && !e.assetLink;
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: c.bg, color: c.fg, whiteSpace: "nowrap" }}>
                    {e.status}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.title}
                  </span>
                  {missingAsset && (
                    <span title="No asset link uploaded yet" style={{ fontSize: 10, color: "#b91c1c", whiteSpace: "nowrap" }}>
                      ⚠ no asset
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>
                    {Array.isArray(e.platforms) && e.platforms.length
                      ? e.platforms[0].split(" ")[0]
                      : (e.platform ?? "").split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </Widget>
  );
}

/* ─────── Outreach feedback last 30 days ─────── */

interface OutreachFeedback {
  total: number;
  feedback: { value: string; label: string; count: number }[];
}

export function OutreachFeedbackSummary() {
  const [data, setData] = useState<OutreachFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const { from, to } = rangeLastNDays(30);

  useEffect(() => {
    fetch(`/api/hubspot/outreach-feedback?from=${from}&to=${to}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d: OutreachFeedback | null) => setData(d))
      .finally(() => setLoading(false));
  }, [from, to]);

  const top = (data?.feedback ?? []).slice().sort((a, b) => b.count - a.count).slice(0, 5);
  const max = top[0]?.count ?? 0;

  return (
    <Widget title="Outreach feedback · 30d" href="/feedback" action={<CountPill n={data?.total ?? 0} />}>
      {loading && <EmptyState>Loading…</EmptyState>}
      {!loading && !data && <EmptyState>HubSpot data unavailable.</EmptyState>}
      {!loading && data && top.length === 0 && <EmptyState>No feedback recorded.</EmptyState>}
      {top.map((f) => {
        const pct = max > 0 ? (f.count / max) * 100 : 0;
        return (
          <div key={f.value} style={{ padding: "8px 18px", borderTop: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0, marginRight: 8 }}>
                {f.label}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{f.count}</span>
            </div>
            <div style={{ height: 4, background: "rgba(0,0,0,0.05)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "#0071E3", transition: "width 200ms" }} />
            </div>
          </div>
        );
      })}
    </Widget>
  );
}

/* ─────── Lifecycle stage breakdown ─────── */

interface LifecycleStage {
  label: string;
  value: string;
  count: number;
}

const LIFECYCLE_COLOURS: Record<string, string> = {
  subscriber: "#94A3B8",
  lead: "#0071E3",
  marketingqualifiedlead: "#8B5CF6",
  salesqualifiedlead: "#F59E0B",
  opportunity: "#EF4444",
  customer: "#30A46C",
  evangelist: "#06B6D4",
  other: "#64748B",
};

export function LifecycleBreakdown() {
  const [stages, setStages] = useState<LifecycleStage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hubspot/lifecycle-stages", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { stages?: LifecycleStage[] } | null) => setStages(d?.stages ?? []))
      .finally(() => setLoading(false));
  }, []);

  const total = stages.reduce((s, st) => s + st.count, 0);
  const sorted = [...stages].sort((a, b) => b.count - a.count);

  return (
    <Widget title="Lifecycle stages" href="/trends" action={<CountPill n={total} />}>
      {loading && <EmptyState>Loading…</EmptyState>}
      {!loading && sorted.length === 0 && <EmptyState>HubSpot data unavailable.</EmptyState>}
      {sorted.map((s) => {
        const pct = total > 0 ? (s.count / total) * 100 : 0;
        const color = LIFECYCLE_COLOURS[s.value] ?? LIFECYCLE_COLOURS.other;
        return (
          <div key={s.value} style={{ padding: "8px 18px", borderTop: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{s.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{pct.toFixed(0)}%</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{s.count.toLocaleString()}</span>
              </div>
            </div>
            <div style={{ height: 4, background: "rgba(0,0,0,0.05)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 200ms" }} />
            </div>
          </div>
        );
      })}
    </Widget>
  );
}

/* ─────── Pipeline value by stage ─────── */

interface PipelineStage {
  stage: string;
  label?: string;
  count: number;
  value: number;
}

interface PipelineValueResp {
  count?: number;
  value?: number;
  totalValue?: number;
  byStage?: PipelineStage[];
  stages?: PipelineStage[];
}

export function PipelineValue() {
  const [data, setData] = useState<PipelineValueResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hubspot/pipeline-value", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d: PipelineValueResp | null) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  const total = data?.value ?? data?.totalValue ?? 0;
  const stages = data?.byStage ?? data?.stages ?? [];
  const max = Math.max(0, ...stages.map((s) => s.value ?? 0));
  const sorted = [...stages].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 6);

  return (
    <Widget
      title="Open pipeline value"
      href="/funnel"
      action={
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
          {fmtGbp(total)}
        </span>
      }
    >
      {loading && <EmptyState>Loading…</EmptyState>}
      {!loading && total === 0 && stages.length === 0 && <EmptyState>HubSpot data unavailable.</EmptyState>}
      {!loading && stages.length === 0 && total > 0 && (
        <div style={{ padding: "12px 18px", fontSize: 12, color: "var(--color-text-secondary)" }}>
          {data?.count ?? 0} open deals · {fmtGbp(total)} total value
        </div>
      )}
      {sorted.map((s) => {
        const pct = max > 0 ? ((s.value ?? 0) / max) * 100 : 0;
        return (
          <div key={s.stage} style={{ padding: "8px 18px", borderTop: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "var(--color-text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>
                {s.label ?? s.stage}
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{s.count}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{fmtGbp(s.value ?? 0)}</span>
              </div>
            </div>
            <div style={{ height: 4, background: "rgba(0,0,0,0.05)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "#30A46C", transition: "width 200ms" }} />
            </div>
          </div>
        );
      })}
    </Widget>
  );
}
