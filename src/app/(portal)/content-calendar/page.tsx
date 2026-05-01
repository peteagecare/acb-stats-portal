"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  CALENDAR_ASSET_TYPES,
  CALENDAR_PLATFORMS,
  CALENDAR_STATUSES,
  CalendarAssetType,
  CalendarEntry,
  CalendarPlatform,
  CalendarStatus,
  STATUS_COLOURS,
  ASSET_TYPE_COLOURS,
  fmtIsoDate,
  weekKey,
  weekLabel,
} from "@/lib/content-calendar";
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
  | { mode: "create"; defaultDate: string }
  | { mode: "edit"; entry: CalendarEntry };

export default function ContentCalendarPage() {
  const [items, setItems] = useState<CalendarEntry[]>([]);
  const [approvals, setApprovals] = useState<ApprovalsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<MeResp | null>(null);
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [filterPlatform, setFilterPlatform] = useState<CalendarPlatform | "all">("all");
  const [filterStatus, setFilterStatus] = useState<CalendarStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [savingApproval, setSavingApproval] = useState<string | null>(null);

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
    setLoading(true);
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
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const isPete = me?.email.toLowerCase() === PETE_EMAIL;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filterPlatform !== "all" && it.platform !== filterPlatform) return false;
      if (filterStatus !== "all" && it.status !== filterStatus) return false;
      if (q && !it.title.toLowerCase().includes(q) && !(it.notes ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filterPlatform, filterStatus, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const it of filtered) {
      const k = weekKey(it.liveDate);
      const arr = map.get(k) ?? [];
      arr.push(it);
      map.set(k, arr);
    }
    const sortedKeys = Array.from(map.keys()).sort();
    return sortedKeys.map((k) => ({
      week: k,
      label: weekLabel(k),
      rows: map.get(k)!.sort((a, b) => {
        if (a.liveDate !== b.liveDate) return a.liveDate.localeCompare(b.liveDate);
        return (a.time ?? "").localeCompare(b.time ?? "");
      }),
    }));
  }, [filtered]);

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

  async function handleInlineSave(id: string, patch: Partial<CalendarEntry>) {
    await handleSave({ id, ...patch });
  }

  async function handleAddRow(weekStart: string) {
    try {
      await handleSave({
        liveDate: weekStart,
        platform: "Facebook & Instagram",
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
          itemKind: entry.platform,
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
          itemKind: entry.platform,
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
      </header>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Search title or notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle({ minWidth: 240 })}
        />
        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value as CalendarPlatform | "all")}
          style={inputStyle()}
        >
          <option value="all">All platforms</option>
          {CALENDAR_PLATFORMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
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
            isPete={isPete}
            myEmail={me?.email ?? ""}
            approvals={approvals}
            savingApproval={savingApproval}
            onEdit={(entry) => setModal({ mode: "edit", entry })}
            onDelete={handleDelete}
            onQuickStatus={handleQuickStatus}
            onApprove={handleApprove}
            onReject={handleReject}
            onInlineSave={handleInlineSave}
            onAddRow={handleAddRow}
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
    </div>
  );
}

function WeekGroup({
  weekStart,
  label,
  rows,
  isPete,
  myEmail,
  approvals,
  savingApproval,
  onEdit,
  onDelete,
  onQuickStatus,
  onApprove,
  onReject,
  onInlineSave,
  onAddRow,
}: {
  weekStart: string;
  label: string;
  rows: CalendarEntry[];
  isPete: boolean;
  myEmail: string;
  approvals: ApprovalsMap;
  savingApproval: string | null;
  onEdit: (entry: CalendarEntry) => void;
  onDelete: (id: string) => void;
  onQuickStatus: (entry: CalendarEntry, status: CalendarStatus) => void;
  onApprove: (entry: CalendarEntry, role: AnyApprovalKey) => void;
  onReject: (entry: CalendarEntry, role: AnyApprovalKey) => void;
  onInlineSave: (id: string, patch: Partial<CalendarEntry>) => Promise<void>;
  onAddRow: (weekStart: string) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const liveCount = rows.filter((r) => r.status !== "Cancelled").length;

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
          {rows.length === 0 && (
            <div style={{ padding: "20px 18px", fontSize: 13, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
              No entries this week yet.
            </div>
          )}
          {rows.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 1400, borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Date", "Time", "Status", "Platform", "Asset", "Title / Idea", "Responsible", "Notes", "Asset link", "Approval", ""].map((h) => (
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
                  {rows.map((entry) => (
                    <Row
                      key={entry.id}
                      entry={entry}
                      isPete={isPete}
                      myEmail={myEmail}
                      approval={approvals[entry.id] ?? {}}
                      savingApproval={savingApproval}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onQuickStatus={onQuickStatus}
                      onApprove={onApprove}
                      onReject={onReject}
                      onInlineSave={onInlineSave}
                    />
                  ))}
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

function Row({
  entry,
  isPete,
  myEmail,
  approval,
  savingApproval,
  onEdit,
  onDelete,
  onQuickStatus,
  onApprove,
  onReject,
  onInlineSave,
}: {
  entry: CalendarEntry;
  isPete: boolean;
  myEmail: string;
  approval: EntryApprovals;
  savingApproval: string | null;
  onEdit: (entry: CalendarEntry) => void;
  onDelete: (id: string) => void;
  onQuickStatus: (entry: CalendarEntry, status: CalendarStatus) => void;
  onApprove: (entry: CalendarEntry, role: AnyApprovalKey) => void;
  onReject: (entry: CalendarEntry, role: AnyApprovalKey) => void;
  onInlineSave: (id: string, patch: Partial<CalendarEntry>) => Promise<void>;
}) {
  const statusColour = STATUS_COLOURS[entry.status];
  const assetColour = entry.assetType ? ASSET_TYPE_COLOURS[entry.assetType] : null;
  const dateObj = new Date(entry.liveDate + "T00:00:00");
  const day = dateObj.toLocaleString("en-GB", { weekday: "short" });
  const dayNum = dateObj.getDate();
  const isMine = entry.submittedBy.toLowerCase() === myEmail.toLowerCase();
  const canDelete = isPete || isMine;

  const save = (patch: Partial<CalendarEntry>) => onInlineSave(entry.id, patch);

  return (
    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
      <EditableCell
        value={entry.liveDate}
        type="date"
        onSave={(v) => save({ liveDate: v })}
        display={
          <>
            <div style={{ fontWeight: 600 }}>{day}</div>
            <div style={{ color: "var(--color-text-secondary)" }}>{dayNum}</div>
          </>
        }
      />
      <EditableCell
        value={entry.time ?? ""}
        type="time"
        onSave={(v) => save({ time: v || undefined })}
      />
      <EditableCell
        value={entry.status}
        type="select"
        options={CALENDAR_STATUSES}
        optionDisabled={(o) => (o === "Approved" || o === "Suggested Changes") && !isPete && o !== entry.status}
        onSave={(v) => save({ status: v as CalendarStatus })}
        display={<span style={pill(statusColour.bg, statusColour.fg)}>{entry.status}</span>}
      />
      <EditableCell
        value={entry.platform}
        type="select"
        options={CALENDAR_PLATFORMS}
        onSave={(v) => save({ platform: v as CalendarPlatform })}
        cellExtra={{ minWidth: 140 }}
        display={<div style={{ fontSize: 12, color: "#374151" }}>{entry.platform}</div>}
      />
      <EditableCell
        value={entry.assetType ?? ""}
        type="select"
        options={CALENDAR_ASSET_TYPES}
        allowEmpty
        onSave={(v) => save({ assetType: (v || undefined) as CalendarAssetType | undefined })}
        display={
          entry.assetType && assetColour ? (
            <span style={pill(assetColour.bg, assetColour.fg)}>{entry.assetType}</span>
          ) : <span style={{ color: "#94a3b8" }}>—</span>
        }
      />
      <EditableCell
        value={entry.title}
        type="text"
        onSave={(v) => save({ title: v })}
        cellExtra={{ minWidth: 240 }}
        display={<div style={{ fontWeight: 600, color: "#0f172a" }}>{entry.title}</div>}
      />
      <EditableCell
        value={entry.responsible ?? ""}
        type="select"
        options={KNOWN_PEOPLE.map((p) => p.label) as readonly string[]}
        allowEmpty
        onSave={(v) => save({ responsible: v || undefined })}
      />
      <EditableCell
        value={entry.notes ?? ""}
        type="textarea"
        onSave={(v) => save({ notes: v || undefined })}
        cellExtra={{ maxWidth: 200 }}
        display={
          <>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#475569" }}>{entry.notes || <span style={{ color: "#94a3b8" }}>—</span>}</div>
            {entry.feedback && (
              <div style={{ marginTop: 6, padding: 6, background: "#fef3c7", borderRadius: 6, fontSize: 11, color: "#78350f" }}>
                <strong>Feedback: </strong>{entry.feedback}
              </div>
            )}
          </>
        }
      />
      <EditableCell
        value={entry.assetLink ?? ""}
        type="text"
        placeholder="https://…"
        onSave={(v) => save({ assetLink: v || undefined })}
        display={
          <>
            {entry.assetLink ? (
              <a href={entry.assetLink} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent, #0071e3)", textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>
                View
              </a>
            ) : <span style={{ color: "#94a3b8" }}>—</span>}
            {entry.supportedLinks?.map((l, i) => (
              <a key={i} href={l} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 11, color: "var(--color-accent, #0071e3)", textDecoration: "none", marginTop: 2 }} onClick={(e) => e.stopPropagation()}>
                Link {i + 1}
              </a>
            ))}
          </>
        }
      />
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
          <button onClick={() => onEdit(entry)} style={btnStyle("#374151", "#f3f4f6")}>Edit</button>
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
  state: { mode: "create"; defaultDate: string } | { mode: "edit"; entry: CalendarEntry };
  onClose: () => void;
  onSave: (payload: Partial<CalendarEntry> & { id?: string }) => Promise<void>;
  isPete: boolean;
}) {
  const initial: Partial<CalendarEntry> =
    state.mode === "edit"
      ? state.entry
      : {
          liveDate: state.defaultDate,
          status: "Not Started",
          needsFinanceApproval: false,
          platform: "Facebook & Instagram",
        };

  const [liveDate, setLiveDate] = useState(initial.liveDate ?? "");
  const [time, setTime] = useState(initial.time ?? "");
  const [platform, setPlatform] = useState<CalendarPlatform>(initial.platform ?? "Facebook & Instagram");
  const [assetType, setAssetType] = useState<CalendarAssetType | "">(initial.assetType ?? "");
  const [status, setStatus] = useState<CalendarStatus>(initial.status ?? "Not Started");
  const [title, setTitle] = useState(initial.title ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [responsible, setResponsible] = useState(initial.responsible ?? "");
  const [assetLink, setAssetLink] = useState(initial.assetLink ?? "");
  const [supportedLinksText, setSupportedLinksText] = useState((initial.supportedLinks ?? []).join("\n"));
  const [feedback, setFeedback] = useState(initial.feedback ?? "");
  const [needsFinanceApproval, setNeedsFinanceApproval] = useState<boolean>(initial.needsFinanceApproval ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isEdit = state.mode === "edit";

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const supportedLinks = supportedLinksText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length);
      const payload: Partial<CalendarEntry> & { id?: string } = {
        id: isEdit ? state.entry.id : undefined,
        liveDate,
        time: time || undefined,
        platform,
        assetType: (assetType || undefined) as CalendarAssetType | undefined,
        status,
        title,
        notes: notes || undefined,
        responsible: responsible || undefined,
        assetLink: assetLink || undefined,
        supportedLinks,
        feedback: feedback || undefined,
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
            {isEdit ? "Edit entry" : "New entry"}
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <ModalField label="Live date" required>
              <input type="date" value={liveDate} onChange={(e) => setLiveDate(e.target.value)} style={modalInput} />
            </ModalField>
            <ModalField label="Time">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={modalInput} />
            </ModalField>
            <ModalField label="Platform" required>
              <select value={platform} onChange={(e) => setPlatform(e.target.value as CalendarPlatform)} style={modalInput}>
                {CALENDAR_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </ModalField>
            <ModalField label="Asset type">
              <select value={assetType} onChange={(e) => setAssetType(e.target.value as CalendarAssetType | "")} style={modalInput}>
                <option value="">—</option>
                {CALENDAR_ASSET_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
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

          {isEdit && (
            <>
              <SectionLabel>Post-go-live</SectionLabel>
              <ModalField label="Feedback">
                <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} style={{ ...modalInput, resize: "vertical" }} />
              </ModalField>
              <div style={{ marginBottom: 18 }} />
            </>
          )}

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
            disabled={busy || !title || !liveDate}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 18px", borderRadius: 999,
              background: "var(--color-accent)", border: "none",
              color: "white", fontSize: 13, fontWeight: 600,
              cursor: busy || !title || !liveDate ? "not-allowed" : "pointer",
              opacity: busy || !title || !liveDate ? 0.55 : 1,
              fontFamily: "inherit",
            }}
          >
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create entry"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function EditableCell({
  value,
  type,
  options,
  allowEmpty,
  optionDisabled,
  display,
  onSave,
  cellExtra,
  placeholder,
}: {
  value: string;
  type: "text" | "textarea" | "date" | "time" | "select";
  options?: readonly string[];
  allowEmpty?: boolean;
  optionDisabled?: (opt: string) => boolean;
  display?: React.ReactNode;
  onSave: (value: string) => Promise<void>;
  cellExtra?: React.CSSProperties;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function commit(next: string) {
    if (busy) return;
    if (next === value) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
      setDraft(value);
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (!editing) {
    const shown = display ?? (value ? value : <span style={{ color: "#94a3b8" }}>—</span>);
    return (
      <td
        style={{ ...cellStyle(cellExtra), cursor: "cell" }}
        onDoubleClick={() => setEditing(true)}
        title="Double-click to edit"
      >
        {shown}
      </td>
    );
  }

  if (type === "select" && options) {
    return (
      <td style={cellStyle(cellExtra)}>
        <select
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            commit(e.target.value);
          }}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === "Escape") cancel(); }}
          disabled={busy}
          style={inputStyle({ width: "100%", fontSize: 12 })}
        >
          {allowEmpty && <option value="">—</option>}
          {options.map((o) => {
            const disabled = optionDisabled?.(o) ?? false;
            return (
              <option key={o} value={o} disabled={disabled}>
                {o}{disabled ? " (Pete only)" : ""}
              </option>
            );
          })}
        </select>
      </td>
    );
  }

  if (type === "textarea") {
    return (
      <td style={cellStyle(cellExtra)}>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); cancel(); }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(draft); }
          }}
          rows={3}
          disabled={busy}
          placeholder={placeholder}
          style={inputStyle({ width: "100%", fontSize: 12, resize: "vertical" })}
        />
      </td>
    );
  }

  const inputType = type === "text" ? "text" : type;
  return (
    <td style={cellStyle(cellExtra)}>
      <input
        autoFocus
        type={inputType}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
          if (e.key === "Enter") { e.preventDefault(); commit(draft); }
        }}
        disabled={busy}
        placeholder={placeholder}
        style={inputStyle({ width: "100%", fontSize: 12 })}
      />
    </td>
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
        access: "public",
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
