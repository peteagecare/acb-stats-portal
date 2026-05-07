"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import {
  CALENDAR_STATUSES,
  CalendarEntry,
  CalendarPlatform,
  CalendarStatus,
  CalendarType,
  STATUS_COLOURS,
  fmtIsoDate,
  shortPlatformLabel,
  weekKey,
  weekLabel,
} from "@/lib/content-calendar";
import { PlatformPills, PlatformPillsDisplay, TypePills, TypePillsDisplay } from "./_platform-pills";
import {
  APPROVAL_ROLES,
  AnyApprovalKey,
  ApprovalRole,
  canApproveAny,
  isDnnaConfirmed,
  isFullyApproved,
  pendingActionsForUser,
} from "@/lib/approval-roles";

interface ApprovalRecord {
  approved: boolean;
  userEmail: string;
  userLabel: string;
  timestamp: string;
}
interface RejectionRecord {
  byRole: AnyApprovalKey;
  userEmail: string;
  userLabel: string;
  note: string;
  timestamp: string;
}
type EntryApprovals = Partial<Record<AnyApprovalKey, ApprovalRecord>> & {
  rejection?: RejectionRecord;
};
type ApprovalsMap = Record<string, EntryApprovals>;

const PETE_EMAIL = "pete@agecare-bathrooms.co.uk";

const KNOWN_PEOPLE = [
  { email: "pete@agecare-bathrooms.co.uk", label: "Pete" },
  { email: "chris@agecare-bathrooms.co.uk", label: "Chris" },
  { email: "sam@agecare-bathrooms.co.uk", label: "Sam" },
  { email: "asim", label: "ASIM" },
];

interface MeResp {
  email: string;
  label?: string;
}

type ModalState =
  | { mode: "closed" }
  | { mode: "create"; defaultDate: string; prefill?: Partial<CalendarEntry> };

interface GhostRow {
  slotId: string;
  date: string;
  time?: string;
  platforms: CalendarPlatform[];
  types: CalendarType[];
  label: string;
}

export default function ContentCalendarPage() {
  const [items, setItems] = useState<CalendarEntry[]>([]);
  const [approvals, setApprovals] = useState<ApprovalsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<MeResp | null>(null);
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [filterPlatforms, setFilterPlatforms] = useState<CalendarPlatform[]>([]);
  const [filterStatus, setFilterStatus] = useState<CalendarStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [savingApproval, setSavingApproval] = useState<string | null>(null);
  const [showIdeas, setShowIdeas] = useState(false);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [scheduleDisabledDays, setScheduleDisabledDays] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetch("/api/posting-schedule")
        .then((r) => (r.ok ? r.json() : { slots: [], disabledDays: [] }))
        .then((d: { slots?: ScheduleSlot[]; disabledDays?: number[] }) => {
          if (cancelled) return;
          setScheduleSlots(d.slots ?? []);
          setScheduleDisabledDays(d.disabledDays ?? []);
        })
        .catch(() => {
          if (cancelled) return;
          setScheduleSlots([]);
          setScheduleDisabledDays([]);
        });
    }
    load();
    // Re-load schedule when the modal closes so calendar sees latest edits
    const handler = () => load();
    window.addEventListener("focus", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", handler);
    };
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MeResp | null) => {
        if (data) setMe(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    function load(showSpinner: boolean) {
      if (showSpinner) setLoading(true);
      Promise.all([
        fetch("/api/content-calendar", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/approvals", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      ])
        .then(([cal, app]: [
          { items?: CalendarEntry[]; error?: string },
          { approvals?: ApprovalsMap },
        ]) => {
          if (cancelled) return;
          if (cal.error) setError(cal.error);
          else setItems(cal.items ?? []);
          setApprovals(app.approvals ?? {});
        })
        .catch((e) => !cancelled && setError(String(e)))
        .finally(() => !cancelled && showSpinner && setLoading(false));
    }
    load(true);
    const onFocus = () => load(false);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const isPete = me?.email.toLowerCase() === PETE_EMAIL;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filterSet = new Set(filterPlatforms);
    return items.filter((it) => {
      if (filterSet.size > 0 && !it.platforms.some((p) => filterSet.has(p))) return false;
      if (filterStatus !== "all" && it.status !== filterStatus) return false;
      if (q && !it.title.toLowerCase().includes(q) && !(it.notes ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filterPlatforms, filterStatus, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const it of filtered) {
      const k = weekKey(it.liveDate);
      const arr = map.get(k) ?? [];
      arr.push(it);
      map.set(k, arr);
    }

    // Always include current week + next 4 weeks even if no entries yet,
    // so the schedule skeleton has somewhere to render.
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i * 7);
      const k = fmtIsoDate(d);
      if (!map.has(k)) map.set(k, []);
    }

    const sortedKeys = Array.from(map.keys()).sort();
    return sortedKeys.map((k) => {
      const rows = (map.get(k) ?? []).sort((a, b) => {
        if (a.liveDate !== b.liveDate) return a.liveDate.localeCompare(b.liveDate);
        return (a.time ?? "").localeCompare(b.time ?? "");
      });

      // Build ghost placeholder rows from the schedule template — only if
      // there's no real entry at the same date that already covers any of the
      // slot's platforms (and matching time, if the slot defines one) AND the
      // slot's weekday isn't disabled.
      const ghosts: GhostRow[] = [];
      const weekMonday = new Date(k + "T00:00:00");
      for (const slot of scheduleSlots) {
        if (scheduleDisabledDays.includes(slot.weekday)) continue;
        const offset = (slot.weekday + 6) % 7; // Mon=1 → 0, Sun=0 → 6
        const slotDate = new Date(weekMonday);
        slotDate.setDate(weekMonday.getDate() + offset);
        const iso = fmtIsoDate(slotDate);
        const slotPlatforms = new Set(slot.platforms);
        const taken = rows.some(
          (r) =>
            r.liveDate === iso &&
            r.platforms.some((p) => slotPlatforms.has(p)) &&
            (slot.time ? r.time === slot.time : true),
        );
        if (taken) continue;
        ghosts.push({
          slotId: slot.id,
          date: iso,
          time: slot.time,
          platforms: slot.platforms,
          types: slot.types,
          label: slot.label,
        });
      }

      return {
        week: k,
        label: weekLabel(k),
        rows,
        ghosts,
      };
    });
  }, [filtered, scheduleSlots, scheduleDisabledDays]);

  async function handleSave(payload: Partial<CalendarEntry> & { id?: string }) {
    const method = payload.id ? "PATCH" : "POST";
    const res = await fetch("/api/content-calendar", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        label: me?.label ?? me?.email,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "save failed");
    setItems(body.items ?? []);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    const res = await fetch(`/api/content-calendar?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const body = await res.json();
    if (!res.ok) {
      alert(body.error ?? "delete failed");
      return;
    }
    setItems(body.items ?? []);
  }

  async function handleAddRow(weekStart: string) {
    try {
      await handleSave({
        liveDate: weekStart,
        platforms: ["Facebook", "Instagram"],
        types: [],
        title: "New entry",
        status: "Not Started",
        needsFinanceApproval: false,
      } as Partial<CalendarEntry>);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleQuickStatus(entry: CalendarEntry, status: CalendarStatus) {
    try {
      await handleSave({ id: entry.id, status });
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  function approvalStateFor(id: string) {
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

  async function handleApprove(entry: CalendarEntry, role: AnyApprovalKey) {
    setSavingApproval(`${entry.id}:${role}`);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          emailId: entry.id,
          role,
          approved: true,
          label: me?.label ?? me?.email,
          itemTitle: entry.title,
          itemKind: entry.platforms.join(", "),
          itemUrl: "/content-calendar",
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "approve failed");
      const next: ApprovalsMap = { ...approvals };
      if (body.emailRecord) next[entry.id] = body.emailRecord;
      else delete next[entry.id];
      setApprovals(next);

      const fullState = {
        pete: !!next[entry.id]?.pete?.approved,
        chris: !!next[entry.id]?.chris?.approved,
        sam: !!next[entry.id]?.sam?.approved,
        outside: !!next[entry.id]?.outside?.approved,
        dnna_pete: !!next[entry.id]?.dnna_pete?.approved,
        dnna_chris: !!next[entry.id]?.dnna_chris?.approved,
      };
      if (isFullyApproved(fullState) && entry.status !== "Approved") {
        await handleSave({ id: entry.id, status: "Approved" });
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingApproval(null);
    }
  }

  async function handleReject(entry: CalendarEntry, role: AnyApprovalKey) {
    const note = prompt("What needs to change?");
    if (!note || !note.trim()) return;
    setSavingApproval(`${entry.id}:reject`);
    try {
      const res = await fetch("/api/approvals", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          emailId: entry.id,
          role,
          note,
          label: me?.label ?? me?.email,
          itemTitle: entry.title,
          itemKind: entry.platforms.join(", "),
          itemUrl: "/content-calendar",
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "reject failed");
      const next: ApprovalsMap = { ...approvals, [entry.id]: { rejection: body.rejection } };
      setApprovals(next);
      await handleSave({ id: entry.id, status: "Suggested Changes" });
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingApproval(null);
    }
  }

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1600, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Content Calendar</h1>
          <p style={{ margin: "6px 0 0", color: "var(--color-text-secondary)", fontSize: 14 }}>
            Double-click any cell to edit. Click <em>+ Add entry to this week</em> at the bottom of any week to drop in a new row.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowIdeas(true)}
            style={{
              background: "#fff",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border)",
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Idea Library
          </button>
          <button
            onClick={() => setModal({ mode: "create", defaultDate: fmtIsoDate(new Date()) })}
            style={{
              background: "var(--color-accent, #0071e3)",
              color: "#fff",
              border: 0,
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + New entry
          </button>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder="Search title or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle({ minWidth: 240 })}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as CalendarStatus | "all")}
            style={inputStyle()}
          >
            <option value="all">All statuses</option>
            {CALENDAR_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>
            {filtered.length} of {items.length} entries
          </span>
          {filterPlatforms.length > 0 && (
            <button
              onClick={() => setFilterPlatforms([])}
              style={{
                background: "transparent",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Clear platform filter
            </button>
          )}
        </div>
        <PlatformPills
          value={filterPlatforms}
          onChange={setFilterPlatforms}
          ariaLabel="Filter by platforms"
        />
      </div>

      {loading && <p style={{ color: "var(--color-text-secondary)" }}>Loading…</p>}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {!loading && grouped.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>
          No entries yet. Click <strong>+ New entry</strong> to add one.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {grouped.map((group) => (
          <WeekGroup
            key={group.week}
            weekStart={group.week}
            label={group.label}
            rows={group.rows}
            ghosts={group.ghosts}
            isPete={isPete}
            myEmail={me?.email ?? ""}
            approvals={approvals}
            savingApproval={savingApproval}
            onDelete={handleDelete}
            onQuickStatus={handleQuickStatus}
            onApprove={handleApprove}
            onReject={handleReject}
            onAddRow={handleAddRow}
            onFillGhost={(g) =>
              setModal({
                mode: "create",
                defaultDate: g.date,
                prefill: { time: g.time, platforms: g.platforms, types: g.types, title: "" },
              })
            }
          />
        ))}
      </div>

      {modal.mode !== "closed" && (
        <EntryModal
          state={modal}
          onClose={() => setModal({ mode: "closed" })}
          onSave={async (payload) => {
            await handleSave(payload);
            setModal({ mode: "closed" });
          }}
          isPete={isPete}
        />
      )}

      {showIdeas && (
        <IdeaLibraryModal
          onClose={() => setShowIdeas(false)}
          existingEntries={items}
          onCreatedEntry={async () => {
            // Refresh calendar after slot fill
            const res = await fetch("/api/content-calendar");
            if (res.ok) {
              const body = await res.json();
              setItems(body.items ?? []);
            }
          }}
        />
      )}
    </div>
  );
}

function WeekGroup({
  weekStart,
  label,
  rows,
  ghosts,
  isPete,
  myEmail,
  approvals,
  savingApproval,
  onDelete,
  onQuickStatus,
  onApprove,
  onReject,
  onAddRow,
  onFillGhost,
}: {
  weekStart: string;
  label: string;
  rows: CalendarEntry[];
  ghosts: GhostRow[];
  isPete: boolean;
  myEmail: string;
  approvals: ApprovalsMap;
  savingApproval: string | null;
  onDelete: (id: string) => void;
  onQuickStatus: (entry: CalendarEntry, status: CalendarStatus) => void;
  onApprove: (entry: CalendarEntry, role: AnyApprovalKey) => void;
  onReject: (entry: CalendarEntry, role: AnyApprovalKey) => void;
  onAddRow: (weekStart: string) => Promise<void>;
  onFillGhost: (g: GhostRow) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const liveCount = rows.filter((r) => r.status !== "Cancelled").length;
  // Merge real rows + ghosts into a single ordered list, marking ghosts with a tag.
  type Mixed = { kind: "real"; entry: CalendarEntry } | { kind: "ghost"; g: GhostRow };
  function mixedDate(m: Mixed): string {
    return m.kind === "real" ? m.entry.liveDate : m.g.date;
  }
  function mixedTime(m: Mixed): string {
    return (m.kind === "real" ? m.entry.time : m.g.time) ?? "";
  }
  const mixed: Mixed[] = [
    ...rows.map((entry): Mixed => ({ kind: "real", entry })),
    ...ghosts.map((g): Mixed => ({ kind: "ghost", g })),
  ].sort((a, b) => {
    const dc = mixedDate(a).localeCompare(mixedDate(b));
    if (dc !== 0) return dc;
    const tc = mixedTime(a).localeCompare(mixedTime(b));
    if (tc !== 0) return tc;
    return a.kind === b.kind ? 0 : a.kind === "real" ? -1 : 1;
  });

  return (
    <section
      style={{
        background: "var(--bg-card)",
        borderRadius: 18,
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 18px",
          borderBottom: collapsed ? "none" : "1px solid var(--color-border)",
        }}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, color: "var(--color-text-secondary)", display: "flex" }}
          aria-label={collapsed ? "Expand" : "Collapse"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 150ms var(--ease-apple)" }}>
            <polyline points="6,9 12,15 18,9" />
          </svg>
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>
          Week of {label}
        </span>
        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", background: "rgba(0,0,0,0.04)", padding: "2px 8px", borderRadius: 999 }}>
          {liveCount}
        </span>
        <div style={{ marginLeft: "auto" }}>
          {!collapsed && (
            <button
              onClick={() => onAddRow(weekStart)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              + Add entry
            </button>
          )}
        </div>
      </header>

      {!collapsed && (
        <>
          {mixed.length === 0 && (
            <div style={{ padding: "20px 18px", fontSize: 13, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
              No entries this week yet.
            </div>
          )}
          {mixed.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 1400, borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Date", "Time", "Status", "Platform", "Type", "Title / Idea", "Responsible", "Notes", "Asset link", "Approval", ""].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "8px 12px",
                          fontWeight: 500,
                          color: "var(--color-text-tertiary)",
                          fontSize: 11,
                          letterSpacing: 0,
                          borderBottom: "1px solid var(--color-border)",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mixed.map((m) =>
                    m.kind === "real" ? (
                      <Row
                        key={m.entry.id}
                        entry={m.entry}
                        isPete={isPete}
                        myEmail={myEmail}
                        approval={approvals[m.entry.id] ?? {}}
                        savingApproval={savingApproval}
                        onDelete={onDelete}
                        onQuickStatus={onQuickStatus}
                        onApprove={onApprove}
                        onReject={onReject}
                      />
                    ) : (
                      <GhostScheduleRow
                        key={`ghost-${m.g.slotId}-${m.g.date}`}
                        ghost={m.g}
                        onClick={() => onFillGhost(m.g)}
                      />
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
          <button
            onClick={() => onAddRow(weekStart)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              width: "100%",
              background: "transparent",
              border: "none",
              borderTop: rows.length ? "1px solid var(--color-border)" : "none",
              cursor: "pointer",
              fontFamily: "inherit",
              color: "var(--color-text-tertiary)",
              fontSize: 13,
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            + Add entry
          </button>
        </>
      )}
    </section>
  );
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function GhostScheduleRow({ ghost, onClick }: { ghost: GhostRow; onClick: () => void }) {
  const dt = new Date(ghost.date + "T00:00:00");
  return (
    <tr
      onClick={onClick}
      style={{
        cursor: "pointer",
        background: "rgba(0,113,227,0.025)",
        borderTop: "1px dashed var(--color-border)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,113,227,0.07)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,113,227,0.025)")}
      title="Click to add an entry to this slot"
    >
      <td style={{ padding: "8px 12px", color: "var(--color-text-tertiary)", fontWeight: 500 }}>
        {WEEKDAY_SHORT[dt.getDay()]} {dt.getDate()}
      </td>
      <td style={{ padding: "8px 12px", color: "var(--color-text-tertiary)" }}>
        {ghost.time ?? "—"}
      </td>
      <td style={{ padding: "8px 12px" }}>
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 999,
            background: "rgba(0,113,227,0.08)",
            color: "var(--color-accent)",
            fontSize: 11,
            fontWeight: 600,
            border: "1px dashed rgba(0,113,227,0.4)",
          }}
        >
          Empty slot
        </span>
      </td>
      <td style={{ padding: "8px 12px" }}>
        <PlatformPillsDisplay value={ghost.platforms} />
      </td>
      <td style={{ padding: "8px 12px" }}>
        <TypePillsDisplay value={ghost.types} />
      </td>
      <td style={{ padding: "8px 12px", color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
        {ghost.label} · click to fill
      </td>
      <td colSpan={5} style={{ padding: "8px 12px", color: "var(--color-text-tertiary)" }}>
        <span style={{ color: "var(--color-accent)", fontSize: 11, fontWeight: 600 }}>+ Add</span>
      </td>
    </tr>
  );
}

function Row({
  entry,
  isPete,
  myEmail,
  approval,
  savingApproval,
  onDelete,
  onQuickStatus,
  onApprove,
  onReject,
}: {
  entry: CalendarEntry;
  isPete: boolean;
  myEmail: string;
  approval: EntryApprovals;
  savingApproval: string | null;
  onDelete: (id: string) => void;
  onQuickStatus: (entry: CalendarEntry, status: CalendarStatus) => void;
  onApprove: (entry: CalendarEntry, role: AnyApprovalKey) => void;
  onReject: (entry: CalendarEntry, role: AnyApprovalKey) => void;
}) {
  const statusColour = STATUS_COLOURS[entry.status];
  const dateObj = new Date(entry.liveDate + "T00:00:00");
  const day = dateObj.toLocaleString("en-GB", { weekday: "short" });
  const dayNum = dateObj.getDate();
  const isMine = entry.submittedBy.toLowerCase() === myEmail.toLowerCase();
  const canDelete = isPete || isMine;
  const notePath = `/content-calendar/entry/${entry.id}`;

  return (
    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
      <td style={cellStyle()}>
        <div style={{ fontWeight: 600 }}>{day}</div>
        <div style={{ color: "var(--color-text-secondary)" }}>{dayNum}</div>
      </td>
      <td style={cellStyle()}>
        {entry.time || <span style={{ color: "#94a3b8" }}>—</span>}
      </td>
      <td style={cellStyle()}>
        <span style={pill(statusColour.bg, statusColour.fg)}>{entry.status}</span>
      </td>
      <td style={cellStyle({ minWidth: 160 })}>
        <PlatformPillsDisplay value={entry.platforms} />
      </td>
      <td style={cellStyle({ minWidth: 120 })}>
        <TypePillsDisplay value={entry.types} />
      </td>
      <td style={cellStyle({ minWidth: 240 })}>
        <Link
          href={notePath}
          style={{ fontWeight: 600, color: "#0f172a", textDecoration: "none" }}
        >
          {entry.title}
        </Link>
      </td>
      <td style={cellStyle()}>
        {entry.responsible || <span style={{ color: "#94a3b8" }}>—</span>}
      </td>
      <td style={cellStyle({ maxWidth: 200 })}>
        <div style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#475569" }}>
          {entry.notes || <span style={{ color: "#94a3b8" }}>—</span>}
        </div>
        {entry.feedback && (
          <div style={{ marginTop: 6, padding: 6, background: "#fef3c7", borderRadius: 6, fontSize: 11, color: "#78350f" }}>
            <strong>Feedback: </strong>{entry.feedback}
          </div>
        )}
      </td>
      <td style={cellStyle()}>
        {entry.assetLink ? (
          <a href={entry.assetLink} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent, #0071e3)", textDecoration: "none" }}>
            View
          </a>
        ) : <span style={{ color: "#94a3b8" }}>—</span>}
        {entry.supportedLinks?.map((l, i) => (
          <a key={i} href={l} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 11, color: "var(--color-accent, #0071e3)", textDecoration: "none", marginTop: 2 }}>
            Link {i + 1}
          </a>
        ))}
      </td>
      <td style={cellStyle({ minWidth: 200 })}>
        {entry.needsFinanceApproval ? (
          <FinanceApprovalCell
            entry={entry}
            approval={approval}
            myEmail={myEmail}
            saving={savingApproval}
            onApprove={onApprove}
            onReject={onReject}
          />
        ) : isPete && (entry.status === "To Check - Pete" || entry.status === "In Progress") ? (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button
              onClick={() => onQuickStatus(entry, "Approved")}
              style={btnStyle("#065f46", "#d1fae5")}
            >
              Approve
            </button>
            <button
              onClick={() => onQuickStatus(entry, "Suggested Changes")}
              style={btnStyle("#78350f", "#fef3c7")}
            >
              Changes
            </button>
          </div>
        ) : entry.status === "Approved" ? (
          <span style={{ fontSize: 11, color: "#065f46" }}>✓ Pete approved</span>
        ) : entry.status === "Suggested Changes" ? (
          <button onClick={() => onQuickStatus(entry, "To Check - Pete")} style={btnStyle("#1e40af", "#dbeafe")}>
            Resubmit
          </button>
        ) : entry.status === "Not Started" || entry.status === "In Progress" ? (
          <button onClick={() => onQuickStatus(entry, "To Check - Pete")} style={btnStyle("#1e40af", "#dbeafe")}>
            Request Pete review
          </button>
        ) : "—"}
      </td>
      <td style={cellStyle()}>
        <div style={{ display: "flex", gap: 4 }}>
          <Link
            href={`/content-calendar/entry/${entry.id}`}
            style={{ ...btnStyle("#374151", "#f3f4f6"), textDecoration: "none", display: "inline-block" }}
          >
            Open
          </Link>
          {canDelete && (
            <button onClick={() => onDelete(entry.id)} style={btnStyle("#7f1d1d", "#fee2e2")}>Del</button>
          )}
        </div>
      </td>
    </tr>
  );
}

function EntryModal({
  state,
  onClose,
  onSave,
  isPete,
}: {
  state: { mode: "create"; defaultDate: string; prefill?: Partial<CalendarEntry> };
  onClose: () => void;
  onSave: (payload: Partial<CalendarEntry>) => Promise<void>;
  isPete: boolean;
}) {
  const initial: Partial<CalendarEntry> = {
    liveDate: state.defaultDate,
    status: "Not Started",
    needsFinanceApproval: false,
    platforms: ["Facebook", "Instagram"],
    types: [],
    ...state.prefill,
  };

  const [liveDate, setLiveDate] = useState(initial.liveDate ?? "");
  const [time, setTime] = useState(initial.time ?? "");
  const [platforms, setPlatforms] = useState<CalendarPlatform[]>(
    initial.platforms && initial.platforms.length ? initial.platforms : ["Facebook", "Instagram"],
  );
  const [types, setTypes] = useState<CalendarType[]>(initial.types ?? []);
  const [status, setStatus] = useState<CalendarStatus>(initial.status ?? "Not Started");
  const [title, setTitle] = useState(initial.title ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [responsible, setResponsible] = useState(initial.responsible ?? "");
  const [assetLink, setAssetLink] = useState(initial.assetLink ?? "");
  const [supportedLinksText, setSupportedLinksText] = useState((initial.supportedLinks ?? []).join("\n"));
  const [needsFinanceApproval, setNeedsFinanceApproval] = useState<boolean>(initial.needsFinanceApproval ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const supportedLinks = supportedLinksText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length);
      if (platforms.length === 0) {
        setErr("Pick at least one platform");
        setBusy(false);
        return;
      }
      const payload: Partial<CalendarEntry> = {
        liveDate,
        time: time || undefined,
        platforms,
        types,
        status,
        title,
        notes: notes || undefined,
        responsible: responsible || undefined,
        assetLink: assetLink || undefined,
        supportedLinks,
        needsFinanceApproval,
      };
      await onSave(payload);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const modalInput: React.CSSProperties = {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid var(--color-border)",
    fontSize: 13,
    fontFamily: "inherit",
    background: "white",
    outline: "none",
    width: "100%",
    color: "var(--color-text-primary)",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.4)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 16,
          boxShadow: "var(--shadow-modal)",
          width: "100%",
          maxWidth: 640,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header style={{ display: "flex", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid var(--color-border)" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--color-text-primary)" }}>
            New entry
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "var(--color-text-secondary)", display: "flex" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          <SectionLabel>Schedule</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <ModalField label="Live date" required>
              <input type="date" value={liveDate} onChange={(e) => setLiveDate(e.target.value)} style={modalInput} />
            </ModalField>
            <ModalField label="Time">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={modalInput} />
            </ModalField>
            <ModalField label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as CalendarStatus)} style={modalInput}>
                {CALENDAR_STATUSES.map((s) => {
                  const restricted = (s === "Approved" || s === "Suggested Changes") && !isPete && status !== s;
                  return (
                    <option key={s} value={s} disabled={restricted}>
                      {s}{restricted ? " (Pete only)" : ""}
                    </option>
                  );
                })}
              </select>
            </ModalField>
            <ModalField label="Responsible">
              <select value={responsible} onChange={(e) => setResponsible(e.target.value)} style={modalInput}>
                <option value="">—</option>
                {KNOWN_PEOPLE.map((p) => <option key={p.email} value={p.label}>{p.label}</option>)}
              </select>
            </ModalField>
          </div>
          <ModalField label="Platforms" required hint={`${platforms.length} selected`}>
            <PlatformPills value={platforms} onChange={setPlatforms} />
          </ModalField>
          <ModalField label="Type" hint={types.length ? `${types.length} selected` : "Optional"}>
            <TypePills value={types} onChange={setTypes} />
          </ModalField>
          <div style={{ marginBottom: 6 }} />

          <SectionLabel>Content</SectionLabel>
          <ModalField label="Title / Content idea" required>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Georgia – Short Cuts – Vision Door" style={modalInput} />
          </ModalField>
          <ModalField label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...modalInput, resize: "vertical" }} />
          </ModalField>
          <div style={{ marginBottom: 18 }} />

          <SectionLabel>Asset & links</SectionLabel>
          <ModalField label="Asset">
            <AssetField value={assetLink} onChange={setAssetLink} />
          </ModalField>
          <ModalField label="Supporting links" hint="One per line">
            <textarea value={supportedLinksText} onChange={(e) => setSupportedLinksText(e.target.value)} rows={3} style={{ ...modalInput, resize: "vertical", fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 12 }} />
          </ModalField>
          <div style={{ marginBottom: 18 }} />

          <SectionLabel>Approval</SectionLabel>
          <label
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              cursor: "pointer",
              padding: 14,
              borderRadius: 12,
              border: needsFinanceApproval ? "1px solid #fca5a5" : "1px solid var(--color-border)",
              background: needsFinanceApproval ? "rgba(254,226,226,0.4)" : "transparent",
              transition: "background 120ms var(--ease-apple), border-color 120ms var(--ease-apple)",
            }}
          >
            <input
              type="checkbox"
              checked={needsFinanceApproval}
              onChange={(e) => setNeedsFinanceApproval(e.target.checked)}
              style={{ marginTop: 2, accentColor: "#dc2626" }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: needsFinanceApproval ? "#991b1b" : "var(--color-text-primary)" }}>
                This piece needs financial approval
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4, lineHeight: 1.45 }}>
                Tick if it mentions pricing, finance options, contractual terms, or anything Chris/Sam needs to sign off. Routes through the Pete → Chris → Sam → Outside flow.
              </div>
            </div>
          </label>

          {err && (
            <div style={{ marginTop: 14, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, color: "#991b1b", fontSize: 13 }}>
              {err}
            </div>
          )}
        </div>

        <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 24px", borderTop: "1px solid var(--color-border)", background: "rgba(0,0,0,0.015)" }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 16px", borderRadius: 999,
              background: "transparent", border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)", fontSize: 13, fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !title || !liveDate || platforms.length === 0}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 18px", borderRadius: 999,
              background: "var(--color-accent)", border: "none",
              color: "white", fontSize: 13, fontWeight: 600,
              cursor: busy || !title || !liveDate || platforms.length === 0 ? "not-allowed" : "pointer",
              opacity: busy || !title || !liveDate || platforms.length === 0 ? 0.55 : 1,
              fontFamily: "inherit",
            }}
          >
            {busy ? "Saving…" : "Create entry"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function FinanceApprovalCell({
  entry,
  approval,
  myEmail,
  saving,
  onApprove,
  onReject,
}: {
  entry: CalendarEntry;
  approval: EntryApprovals;
  myEmail: string;
  saving: string | null;
  onApprove: (entry: CalendarEntry, role: AnyApprovalKey) => void;
  onReject: (entry: CalendarEntry, role: AnyApprovalKey) => void;
}) {
  const state = {
    pete: !!approval.pete?.approved,
    chris: !!approval.chris?.approved,
    sam: !!approval.sam?.approved,
    outside: !!approval.outside?.approved,
    dnna_pete: !!approval.dnna_pete?.approved,
    dnna_chris: !!approval.dnna_chris?.approved,
    rejected: !!approval.rejection,
  };
  const dnnaConfirmed = isDnnaConfirmed(state);
  const fullyApproved = isFullyApproved(state);
  const pending = pendingActionsForUser(myEmail, state);
  const myPendingApprove = pending.find((p) => p.kind === "approve");

  if (fullyApproved) {
    return (
      <div style={{ fontSize: 11, color: "#065f46" }}>
        ✓ Fully approved{dnnaConfirmed ? " (no approval needed)" : ""}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {APPROVAL_ROLES.map((r) => {
          const ok = !!approval[r.key]?.approved;
          return (
            <span
              key={r.key}
              title={r.label + (ok ? ` — approved by ${approval[r.key]?.userLabel}` : " — pending")}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 4,
                background: ok ? "#d1fae5" : "#f3f4f6",
                color: ok ? "#065f46" : "#6b7280",
              }}
            >
              {r.key === "outside" ? "Out" : r.key[0].toUpperCase() + r.key.slice(1)} {ok ? "✓" : "·"}
            </span>
          );
        })}
      </div>
      {state.rejected && approval.rejection && (
        <div style={{ fontSize: 10, color: "#991b1b", background: "#fee2e2", padding: 4, borderRadius: 4 }}>
          <strong>Changes:</strong> {approval.rejection.note}
        </div>
      )}
      {myPendingApprove && (
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => onApprove(entry, myPendingApprove.key)}
            disabled={saving === `${entry.id}:${myPendingApprove.key}`}
            style={btnStyle("#065f46", "#d1fae5")}
          >
            {saving === `${entry.id}:${myPendingApprove.key}` ? "…" : `Approve as ${myPendingApprove.key}`}
          </button>
          {canApproveAny("pete" as ApprovalRole, myEmail) && !state.rejected && (
            <button
              onClick={() => onReject(entry, "pete")}
              disabled={saving === `${entry.id}:reject`}
              style={btnStyle("#991b1b", "#fee2e2")}
            >
              Changes
            </button>
          )}
        </div>
      )}
      {!myPendingApprove && !fullyApproved && (
        <span style={{ fontSize: 10, color: "#6b7280" }}>
          Awaiting{" "}
          {APPROVAL_ROLES.filter((r) => !approval[r.key]?.approved)
            .map((r) => r.label.split(" (")[0])
            .join(", ")}
        </span>
      )}
    </div>
  );
}

function AssetField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function pickFile(file: File) {
    setErr(null);
    setUploading({ name: file.name, pct: 0 });
    try {
      const blob = await upload(file.name, file, {
        access: "private",
        handleUploadUrl: "/api/content-calendar/upload",
        onUploadProgress: (e) => {
          const pct = "percentage" in e ? e.percentage : 0;
          setUploading({ name: file.name, pct: Math.round(pct ?? 0) });
        },
      });
      onChange(blob.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…  or upload a file →" style={inputStyle({ width: "100%" })} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!!uploading}
          style={btnStyle("#374151", "#f3f4f6", { padding: "6px 12px", fontSize: 12 })}
        >
          {uploading ? `Uploading ${uploading.pct}%` : "Upload file"}
        </button>
        {value && !uploading && (
          <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--color-accent, #0071e3)", textDecoration: "none" }}>
            Preview ↗
          </a>
        )}
        {value && !uploading && (
          <button type="button" onClick={() => onChange("")} style={btnStyle("#7f1d1d", "transparent", { padding: "4px 8px", fontSize: 11 })}>
            Clear
          </button>
        )}
      </div>
      {err && <span style={{ fontSize: 11, color: "#b91c1c" }}>{err}</span>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pickFile(f);
        }}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "var(--color-text-tertiary)",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function ModalField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)" }}>{label}</span>
        {required && <span style={{ fontSize: 11, color: "#dc2626" }}>*</span>}
        {hint && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginLeft: "auto" }}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function inputStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 13,
    background: "#fff",
    ...extra,
  };
}

function cellStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: "10px 12px",
    verticalAlign: "top",
    fontSize: 12,
    color: "#1f2937",
    ...extra,
  };
}

function pill(bg: string, fg: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: 999,
    background: bg,
    color: fg,
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
}

function btnStyle(fg: string, bg: string, extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    background: bg,
    color: fg,
    border: 0,
    padding: "5px 10px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    ...extra,
  };
}

/* ─── Idea Library + Schedule template ─────────────────────────────── */

interface ContentIdea {
  id: string;
  title: string;
  notes?: string;
  platforms?: CalendarPlatform[];
  createdAt: string;
  createdBy: string;
}
interface ScheduleSlot {
  id: string;
  weekday: number; // 0=Sun..6=Sat
  time?: string;
  platforms: CalendarPlatform[];
  types: CalendarType[];
  label: string;
}

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function IdeaLibraryModal({
  onClose,
  existingEntries,
  onCreatedEntry,
}: {
  onClose: () => void;
  existingEntries: CalendarEntry[];
  onCreatedEntry: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"ideas" | "schedule">("ideas");
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [disabledDays, setDisabledDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIdea, setNewIdea] = useState("");
  const [newIdeaNotes, setNewIdeaNotes] = useState("");
  const [newIdeaPlatforms, setNewIdeaPlatforms] = useState<CalendarPlatform[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/content-ideas").then((r) => (r.ok ? r.json() : { ideas: [] })),
      fetch("/api/posting-schedule").then((r) => (r.ok ? r.json() : { slots: [] })),
    ])
      .then(([i, s]) => {
        if (cancelled) return;
        setIdeas(i.ideas ?? []);
        setSlots(s.slots ?? []);
        setDisabledDays(s.disabledDays ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function addIdea() {
    const title = newIdea.trim();
    if (!title) return;
    const res = await fetch("/api/content-ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        notes: newIdeaNotes.trim() || undefined,
        platforms: newIdeaPlatforms.length ? newIdeaPlatforms : undefined,
      }),
    });
    if (res.ok) {
      const idea = (await res.json()) as ContentIdea;
      setIdeas((prev) => [idea, ...prev]);
      setNewIdea("");
      setNewIdeaNotes("");
      setNewIdeaPlatforms([]);
    }
  }

  async function patchIdea(id: string, patch: Partial<ContentIdea>) {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    await fetch("/api/content-ideas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
  }

  async function deleteIdea(id: string) {
    const res = await fetch(`/api/content-ideas?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setIdeas((prev) => prev.filter((i) => i.id !== id));
  }

  function findNextSlotDate(slot: ScheduleSlot, fromDate: Date): string {
    const slotPlatforms = new Set(slot.platforms);
    // Walk forward day by day up to 12 weeks
    for (let i = 0; i < 84; i++) {
      const d = new Date(fromDate);
      d.setDate(fromDate.getDate() + i);
      if (d.getDay() !== slot.weekday) continue;
      const iso = fmtIsoDate(d);
      const conflict = existingEntries.some(
        (e) =>
          e.liveDate === iso &&
          e.platforms.some((p) => slotPlatforms.has(p)) &&
          (slot.time ? e.time === slot.time : true),
      );
      if (!conflict) return iso;
    }
    return fmtIsoDate(fromDate);
  }

  /** Find the next available slot — optionally restricted to slots whose platform set overlaps the idea's preferred platforms. */
  function nextAvailableSlot(preferred?: CalendarPlatform[]): { slot: ScheduleSlot; date: string } | null {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const preferredSet = preferred && preferred.length ? new Set(preferred) : null;
    const candidates = (preferredSet
      ? slots.filter((s) => s.platforms.some((p) => preferredSet.has(p)))
      : slots
    ).filter((s) => !disabledDays.includes(s.weekday));
    let best: { slot: ScheduleSlot; date: string } | null = null;
    for (const slot of candidates) {
      const date = findNextSlotDate(slot, today);
      if (!best || date < best.date || (date === best.date && (slot.time ?? "99:99") < (best.slot.time ?? "99:99"))) {
        best = { slot, date };
      }
    }
    return best;
  }

  async function addToNextSlot(idea: ContentIdea) {
    const next = nextAvailableSlot(idea.platforms);
    if (!next) {
      setToast(
        idea.platforms && idea.platforms.length
          ? `No free slots matching ${idea.platforms.map(shortPlatformLabel).join(" / ")} in your schedule.`
          : "No slots in your schedule yet.",
      );
      return;
    }
    setBusyId(idea.id);
    try {
      const payload: Partial<CalendarEntry> & { liveDate: string; platforms: CalendarPlatform[]; status: CalendarStatus; title: string } = {
        liveDate: next.date,
        time: next.slot.time,
        platforms: next.slot.platforms,
        types: next.slot.types,
        status: "Not Started",
        title: idea.title,
        notes: idea.notes,
        needsFinanceApproval: false,
      };
      const res = await fetch("/api/content-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await onCreatedEntry();
        const dt = new Date(`${next.date}T00:00:00`);
        const day = WEEKDAY_LABELS[dt.getDay()];
        setToast(`Added "${idea.title}" to ${day} ${dt.getDate()}/${dt.getMonth() + 1} — ${next.slot.label}`);
        setTimeout(() => setToast(null), 4000);
      } else {
        const j = await res.json().catch(() => ({}));
        setToast(j.error ?? "Failed to add entry");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function saveSchedule(nextSlots: ScheduleSlot[], nextDisabled: number[]) {
    setSlots(nextSlots);
    setDisabledDays(nextDisabled);
    await fetch("/api/posting-schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots: nextSlots, disabledDays: nextDisabled }),
    });
  }

  function updateSlot(id: string, patch: Partial<ScheduleSlot>) {
    saveSchedule(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)), disabledDays);
  }
  function deleteSlot(id: string) {
    saveSchedule(slots.filter((s) => s.id !== id), disabledDays);
  }
  function addSlot(weekday: number, platformsDefault?: CalendarPlatform[]) {
    const newSlot: ScheduleSlot = {
      id: crypto.randomUUID(),
      weekday,
      platforms: platformsDefault && platformsDefault.length ? platformsDefault : ["Facebook", "Instagram"],
      types: ["Image"],
      label: "New slot",
    };
    saveSchedule([...slots, newSlot], disabledDays);
  }
  function toggleDay(weekday: number) {
    const next = disabledDays.includes(weekday)
      ? disabledDays.filter((d) => d !== weekday)
      : [...disabledDays, weekday];
    saveSchedule(slots, next);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 14, width: "100%", maxWidth: tab === "schedule" ? 1280 : 920,
          maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Idea Library</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "var(--color-text-secondary)", padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 4, padding: "10px 20px 0", borderBottom: "1px solid var(--color-border)" }}>
          {(["ideas", "schedule"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: "transparent", border: "none", padding: "8px 14px",
                borderBottom: tab === t ? "2px solid var(--color-accent)" : "2px solid transparent",
                color: tab === t ? "var(--color-accent)" : "var(--color-text-secondary)",
                fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: -1,
              }}
            >
              {t === "ideas" ? "Ideas" : "Schedule"}
            </button>
          ))}
        </div>

        {toast && (
          <div style={{ padding: "8px 20px", background: "#ECFDF5", color: "#065F46", fontSize: 12, fontWeight: 500 }}>
            {toast}
          </div>
        )}

        <div style={{ overflowY: "auto", padding: 20 }}>
          {loading && <p style={{ color: "var(--color-text-secondary)" }}>Loading…</p>}

          {!loading && tab === "ideas" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <input
                    value={newIdea}
                    onChange={(e) => setNewIdea(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) addIdea(); }}
                    placeholder="New idea…"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 13, fontFamily: "inherit" }}
                  />
                  <input
                    value={newIdeaNotes}
                    onChange={(e) => setNewIdeaNotes(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) addIdea(); }}
                    placeholder="Notes (optional)"
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12, fontFamily: "inherit", color: "var(--color-text-secondary)" }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Preferred platforms (optional)
                    </span>
                    <PlatformPills
                      value={newIdeaPlatforms}
                      onChange={setNewIdeaPlatforms}
                      size="sm"
                      ariaLabel="Preferred platforms for new idea"
                    />
                    <button
                      onClick={addIdea}
                      disabled={!newIdea.trim()}
                      style={{
                        alignSelf: "flex-start",
                        padding: "6px 14px", borderRadius: 8, border: 0,
                        background: newIdea.trim() ? "var(--color-accent)" : "#E5E7EB",
                        color: newIdea.trim() ? "#fff" : "var(--color-text-tertiary)",
                        fontSize: 12, fontWeight: 600, cursor: newIdea.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      + New idea
                    </button>
                  </div>
                </div>
              </div>

              {ideas.length === 0 && (
                <p style={{ color: "var(--color-text-tertiary)", fontStyle: "italic", fontSize: 13 }}>No ideas yet.</p>
              )}
              {ideas.map((idea) => (
                <div key={idea.id} style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <Link
                      href={`/content-calendar/idea/${idea.id}`}
                      onClick={onClose}
                      style={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-primary)" }}>{idea.title}</div>
                      {idea.notes && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{idea.notes}</div>}
                      <div style={{ fontSize: 10, color: "var(--color-accent)", marginTop: 4 }}>Open full notes →</div>
                    </Link>
                    <button
                      onClick={() => addToNextSlot(idea)}
                      disabled={busyId === idea.id}
                      style={{
                        background: "var(--color-accent)", color: "#fff", border: 0,
                        padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                        cursor: busyId === idea.id ? "wait" : "pointer", whiteSpace: "nowrap",
                      }}
                    >
                      {busyId === idea.id ? "Adding…" : "Add to next slot"}
                    </button>
                    <button
                      onClick={() => deleteIdea(idea.id)}
                      title="Delete idea"
                      style={{
                        background: "transparent", border: "1px solid var(--color-border)",
                        padding: "6px 10px", borderRadius: 8, fontSize: 11,
                        color: "var(--color-text-secondary)", cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      Preferred platforms
                    </div>
                    <PlatformPills
                      value={idea.platforms ?? []}
                      onChange={(next) => patchIdea(idea.id, { platforms: next.length ? next : undefined })}
                      size="sm"
                      ariaLabel={`Preferred platforms for ${idea.title}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && tab === "schedule" && (
            <ScheduleEditor
              slots={slots}
              disabledDays={disabledDays}
              onUpdate={updateSlot}
              onDelete={deleteSlot}
              onAdd={addSlot}
              onToggleDay={toggleDay}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ScheduleEditor({
  slots,
  disabledDays,
  onUpdate,
  onDelete,
  onAdd,
  onToggleDay,
}: {
  slots: ScheduleSlot[];
  disabledDays: number[];
  onUpdate: (id: string, patch: Partial<ScheduleSlot>) => void;
  onDelete: (id: string) => void;
  onAdd: (weekday: number, platformsDefault?: CalendarPlatform[]) => void;
  onToggleDay: (weekday: number) => void;
}) {
  const days = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun
  const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const [platformFilter, setPlatformFilter] = useState<CalendarPlatform | "all">("all");

  const platformsInUse = useMemo(() => {
    const set = new Set<CalendarPlatform>();
    for (const s of slots) for (const p of s.platforms) set.add(p);
    return Array.from(set).sort();
  }, [slots]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>
        Edit your weekly posting skeleton. Each slot defines a day / time / platforms combo and shows up as a placeholder row on the content calendar until you fill it.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Filter
        </span>
        <button
          onClick={() => setPlatformFilter("all")}
          style={chipStyle(platformFilter === "all")}
        >
          All platforms ({slots.length})
        </button>
        {platformsInUse.map((p) => {
          const count = slots.filter((s) => s.platforms.includes(p)).length;
          return (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              style={chipStyle(platformFilter === p)}
              title={p}
            >
              {shortPlatformLabel(p)} ({count})
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(150px, 1fr))",
          gap: 8,
          alignItems: "stretch",
        }}
      >
        {days.map((wd) => {
          const offDay = disabledDays.includes(wd);
          const daySlots = slots
            .filter((s) => s.weekday === wd)
            .filter((s) => platformFilter === "all" || s.platforms.includes(platformFilter))
            .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
          return (
            <div
              key={wd}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#fff",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                overflow: "hidden",
                opacity: offDay ? 0.55 : 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 8px",
                  borderBottom: "1px solid var(--color-border)",
                  background: "#FAFAFA",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700 }}>{dayShort[wd]}</div>
                <DayToggle on={!offDay} onChange={() => onToggleDay(wd)} />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: 8,
                  flex: 1,
                  minHeight: 80,
                }}
              >
                {daySlots.length === 0 ? (
                  <p style={{ margin: "8px 0", fontSize: 11, color: "var(--color-text-tertiary)", fontStyle: "italic", textAlign: "center" }}>
                    {platformFilter === "all" ? "No slots" : "—"}
                  </p>
                ) : (
                  daySlots.map((s) => (
                    <SlotCard
                      key={s.id}
                      slot={s}
                      onUpdate={(patch) => onUpdate(s.id, patch)}
                      onDelete={() => onDelete(s.id)}
                    />
                  ))
                )}
                <button
                  onClick={() => onAdd(wd, platformFilter === "all" ? undefined : [platformFilter])}
                  style={{
                    marginTop: "auto",
                    background: "transparent",
                    border: "1px dashed var(--color-border)",
                    borderRadius: 6,
                    padding: "4px 6px",
                    fontSize: 11,
                    color: "var(--color-text-tertiary)",
                    cursor: "pointer",
                  }}
                >
                  + Add slot
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
    background: active ? "rgba(0,113,227,0.08)" : "transparent",
    color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

function DayToggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={on}
      title={on ? "Day on — click to disable" : "Day off — click to enable"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 6px 2px 10px",
        borderRadius: 999,
        border: "none",
        background: on ? "rgba(16,185,129,0.12)" : "rgba(0,0,0,0.06)",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, color: on ? "#10B981" : "var(--color-text-tertiary)" }}>
        {on ? "On" : "Off"}
      </span>
      <span
        style={{
          width: 22,
          height: 13,
          borderRadius: 999,
          background: on ? "#10B981" : "rgba(0,0,0,0.15)",
          position: "relative",
          transition: "background 120ms",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1.5,
            left: on ? 11 : 1.5,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 120ms",
          }}
        />
      </span>
    </button>
  );
}

function SlotCard({
  slot,
  onUpdate,
  onDelete,
}: {
  slot: ScheduleSlot;
  onUpdate: (patch: Partial<ScheduleSlot>) => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        background: "#FAFAFA",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: 6,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        position: "relative",
      }}
    >
      <button
        onClick={onDelete}
        title="Delete slot"
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          background: "transparent",
          border: "none",
          fontSize: 14,
          lineHeight: 1,
          color: "var(--color-text-tertiary)",
          cursor: "pointer",
          padding: 0,
        }}
      >
        ×
      </button>
      <input
        value={slot.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
        placeholder="Label"
        style={{
          padding: "3px 6px",
          paddingRight: 18,
          borderRadius: 5,
          border: "1px solid var(--color-border)",
          fontSize: 11,
          fontFamily: "inherit",
          fontWeight: 600,
          background: "#fff",
        }}
      />
      <input
        type="time"
        value={slot.time ?? ""}
        onChange={(e) => onUpdate({ time: e.target.value || undefined })}
        style={{
          padding: "3px 6px",
          borderRadius: 5,
          border: "1px solid var(--color-border)",
          fontSize: 11,
          fontFamily: "inherit",
          background: "#fff",
        }}
      />
      <div style={{ fontSize: 9, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>
        Platforms
      </div>
      <PlatformPills
        value={slot.platforms}
        onChange={(next) => onUpdate({ platforms: next.length ? next : slot.platforms })}
        size="sm"
        ariaLabel={`Platforms for ${slot.label}`}
      />
      <div style={{ fontSize: 9, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>
        Type
      </div>
      <TypePills
        value={slot.types}
        onChange={(next) => onUpdate({ types: next })}
        size="sm"
        ariaLabel={`Types for ${slot.label}`}
      />
    </div>
  );
}
