"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Avatar,
  DirectoryUser,
  Modal,
  PRIORITY_META,
  colorForEmail,
  fmtDate,
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  useUsers,
  userMeta,
} from "./_shared";
import { TagPillList, useTags } from "./_tags";
import { DatePicker, ProjectPicker, UserPicker } from "@/app/components/Pickers";

interface DashboardTask {
  id: string;
  title: string;
  ownerEmail: string | null;
  createdByEmail: string;
  startDate: string | null;
  endDate: string | null;
  status: "todo" | "doing" | "blocked" | "done";
  priority: "low" | "medium" | "high" | null;
  completed: boolean;
  completedAt: string | null;
  parentTaskId: string | null;
  projectId: string;
  projectName: string;
  projectStatus: string;
  companyId: string;
  companyName: string;
  collaborators: string[];
  tagIds: string[];
}

interface CompanyRow {
  id: string;
  name: string;
  description: string | null;
  accessMode: "everyone" | "restricted";
  projectCount: number;
}

interface UnsortedNoteTask {
  id: string;
  title: string;
  completed: boolean;
  ownerEmail: string | null;
  endDate: string | null;
  createdAt: string;
  noteId: string;
  noteTitle: string;
  noteMeetingDate: string | null;
}

interface CompanyWithProjects {
  id: string;
  name: string;
  projects: { id: string; name: string }[];
}

export default function WorkspacePage() {
  const users = useUsers();
  const [data, setData] = useState<{ me: string; tasks: DashboardTask[] } | null>(null);
  const [companies, setCompanies] = useState<CompanyRow[] | null>(null);
  const [companiesWithProjects, setCompaniesWithProjects] = useState<CompanyWithProjects[]>([]);
  const [unsorted, setUnsorted] = useState<UnsortedNoteTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creatingCompany, setCreatingCompany] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [dRes, cRes, uRes] = await Promise.all([
        fetch("/api/workspace/dashboard", { cache: "no-store" }),
        fetch("/api/companies", { cache: "no-store" }),
        fetch("/api/notes/unsorted-tasks", { cache: "no-store" }),
      ]);
      if (!dRes.ok) throw new Error(`HTTP ${dRes.status}`);
      if (!cRes.ok) throw new Error(`HTTP ${cRes.status}`);
      const d = (await dRes.json()) as { me: string; tasks: DashboardTask[] };
      const c = (await cRes.json()) as { companies: CompanyRow[] };
      const u = uRes.ok ? ((await uRes.json()) as { tasks: UnsortedNoteTask[] }) : { tasks: [] };
      setData(d);
      setCompanies(c.companies);
      setUnsorted(u.tasks);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Load projects for each company once for the assign dropdown
  useEffect(() => {
    if (!companies || companies.length === 0) return;
    (async () => {
      const result = await Promise.all(companies.map(async (c) => {
        const pRes = await fetch(`/api/projects?companyId=${c.id}`);
        if (!pRes.ok) return { id: c.id, name: c.name, projects: [] };
        const pJson = (await pRes.json()) as { projects: { id: string; name: string }[] };
        return { id: c.id, name: c.name, projects: pJson.projects };
      }));
      setCompaniesWithProjects(result);
    })();
  }, [companies]);

  return (
    <div className="wsp-page" style={{ padding: "32px 36px 64px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 22, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Task Dashboard</h1>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
            Your tasks, your team, your companies in one place.
          </p>
        </div>
        <button onClick={() => setCreatingCompany(true)} style={{ ...primaryButtonStyle, marginLeft: "auto" }}>
          + New company
        </button>
      </div>

      {error && (
        <div style={{ padding: 16, background: "#FEE2E2", color: "#991B1B", borderRadius: 12, fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {!data && !error && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>Loading…</div>
      )}

      {data && companies && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {unsorted.length > 0 && (
            <UnsortedNotes
              tasks={unsorted}
              users={users}
              companies={companiesWithProjects}
              onChanged={refresh}
            />
          )}
          <CompaniesGrid companies={companies} onNew={() => setCreatingCompany(true)} />
          <TasksTabs data={data} users={users} />
          <AssignedByMe data={data} users={users} />
          <PeopleWidget tasks={data.tasks} users={users} />
        </div>
      )}

      {creatingCompany && (
        <NewCompanyModal onClose={() => setCreatingCompany(false)} onCreated={() => { setCreatingCompany(false); refresh(); }} />
      )}
    </div>
  );
}

/* ── Meeting notes to sort ── */

function UnsortedNotes({
  tasks, users, companies, onChanged,
}: {
  tasks: UnsortedNoteTask[];
  users: DirectoryUser[];
  companies: CompanyWithProjects[];
  onChanged: () => void;
}) {
  async function assign(task: UnsortedNoteTask, projectId: string) {
    const res = await fetch(`/api/notes/${task.noteId}/tasks/${task.id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    if (res.ok) onChanged();
  }
  async function remove(task: UnsortedNoteTask) {
    const res = await fetch(`/api/notes/${task.noteId}/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }
  async function complete(task: UnsortedNoteTask) {
    const res = await fetch(`/api/notes/${task.noteId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    if (res.ok) onChanged();
  }
  async function setField(task: UnsortedNoteTask, patch: { ownerEmail?: string | null; endDate?: string | null }) {
    const res = await fetch(`/api/notes/${task.noteId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) onChanged();
  }

  return (
    <section style={{
      background: "var(--bg-card)", borderRadius: 18,
      padding: "16px 20px 8px",
      boxShadow: "var(--shadow-card)",
      border: "1px solid #FCD34D",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{
          fontSize: 11, fontWeight: 700,
          padding: "2px 8px", borderRadius: 999,
          background: "#FEF3C7", color: "#92400E",
          textTransform: "uppercase", letterSpacing: 0.5,
        }}>
          {tasks.length} to sort
        </span>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Meeting Notes To Sort</h2>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 8px" }}>
        To-dos from your notes that don&apos;t have a project yet.
      </p>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {tasks.map((t) => (
          <UnsortedRow
            key={t.id}
            task={t}
            users={users}
            companies={companies}
            onAssign={(projectId) => assign(t, projectId)}
            onComplete={() => complete(t)}
            onDelete={() => remove(t)}
            onSetField={(patch) => setField(t, patch)}
          />
        ))}
      </div>
    </section>
  );
}

function UnsortedRow({
  task, users, companies, onAssign, onComplete, onDelete, onSetField,
}: {
  task: UnsortedNoteTask;
  users: DirectoryUser[];
  companies: CompanyWithProjects[];
  onAssign: (projectId: string) => void;
  onComplete: () => void;
  onDelete: () => void;
  onSetField: (patch: { ownerEmail?: string | null; endDate?: string | null }) => void;
}) {
  const owner = users.find((u) => u.email === task.ownerEmail) ?? null;
  return (
    <div className="unsorted-row" style={{
      display: "flex", alignItems: "center", gap: 4,
      padding: "6px 4px", borderTop: "1px solid var(--color-border)",
    }}>
      <button
        onClick={onComplete}
        aria-label="Mark complete"
        title="Mark complete"
        style={{
          width: 18, height: 18, borderRadius: "50%",
          border: "1.5px solid var(--color-text-tertiary)",
          background: "transparent",
          cursor: "pointer", padding: 0, flexShrink: 0,
          marginRight: 6,
        }}
      />
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 14, color: "var(--color-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {task.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
          From: <Link href="/notes" style={{ color: "inherit", textDecoration: "underline" }}>
            {task.noteTitle || "Untitled meeting"}
          </Link>
          {task.noteMeetingDate && ` · ${fmtDate(task.noteMeetingDate)}`}
        </div>
      </div>

      {/* Assignee — avatar pill */}
      <UserPicker
        selected={task.ownerEmail}
        users={users}
        onChange={(v) => onSetField({ ownerEmail: v })}
      >
        {({ onClick, ref }) => (
          <button
            ref={ref}
            onClick={onClick}
            type="button"
            className="task-panel-control"
            title={owner ? `Assigned to ${owner.label}` : "Assign…"}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 8px", borderRadius: 999, height: 28,
              cursor: "pointer", fontSize: 12, fontFamily: "inherit",
            }}
          >
            {owner ? (
              <>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: owner.color, color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700,
                }}>{(owner.label || "?").trim().slice(0, 1).toUpperCase()}</span>
                <span style={{ color: "var(--color-text-primary)" }}>{owner.label}</span>
              </>
            ) : (
              <span style={{
                width: 20, height: 20, borderRadius: "50%",
                border: "1.5px dashed var(--color-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--color-text-tertiary)",
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 21c0-3.5 3-6 7-6s7 2.5 7 6" />
                </svg>
              </span>
            )}
          </button>
        )}
      </UserPicker>

      {/* Due date — calendar icon when empty, icon + date when set */}
      <DatePicker
        value={task.endDate}
        onChange={(iso) => onSetField({ endDate: iso })}
      >
        {({ onClick, ref }) => (
          <button
            ref={ref}
            onClick={onClick}
            type="button"
            className="task-panel-control"
            title={task.endDate ? `Due ${fmtDate(task.endDate)}` : "Set due date"}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 8px", borderRadius: 999, height: 28,
              cursor: "pointer", fontSize: 12, fontFamily: "inherit",
              color: task.endDate ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
            }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: "50%",
              border: task.endDate ? "1.5px solid var(--color-text-tertiary)" : "1.5px dashed var(--color-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="8" y1="3" x2="8" y2="7" />
                <line x1="16" y1="3" x2="16" y2="7" />
              </svg>
            </span>
            {task.endDate && <span>{fmtDate(task.endDate)}</span>}
          </button>
        )}
      </DatePicker>

      {/* Add-to-project pill */}
      <ProjectPicker
        selected={null}
        companies={companies}
        onChange={(v) => { if (v) onAssign(v); }}
      >
        {({ onClick, ref }) => (
          <button
            ref={ref}
            onClick={onClick}
            type="button"
            className="task-panel-control"
            title="Add to project"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 999, height: 28,
              cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: "inherit",
              color: "var(--color-text-secondary)",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add to project
          </button>
        )}
      </ProjectPicker>

      <button
        onClick={onDelete}
        aria-label="Delete"
        title="Delete"
        className="unsorted-row-delete"
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: "var(--color-text-tertiary)", padding: 6,
          display: "flex", alignItems: "center",
          opacity: 0,
          transition: "opacity 100ms var(--ease-apple)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      </button>
    </div>
  );
}

/* ── Companies grid ── */

function CompaniesGrid({ companies, onNew }: { companies: CompanyRow[]; onNew: () => void }) {
  if (companies.length === 0) {
    return (
      <section style={{
        padding: "48px 24px", textAlign: "center",
        background: "var(--bg-card)", borderRadius: 18, boxShadow: "var(--shadow-card)",
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No companies yet</div>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px" }}>
          Create your first company to start adding projects and tasks.
        </p>
        <button onClick={onNew} style={primaryButtonStyle}>+ New company</button>
      </section>
    );
  }
  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--color-text-secondary)" }}>
        Companies
      </h2>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 12,
      }}>
        {companies.map((c) => (
          <Link
            key={c.id}
            href={`/workspace/${c.id}`}
            style={{
              display: "block", padding: "14px 16px",
              background: "var(--bg-card)", borderRadius: 14,
              boxShadow: "var(--shadow-card)",
              textDecoration: "none", color: "inherit",
              transition: "box-shadow 150ms var(--ease-apple), transform 120ms var(--ease-apple)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "var(--shadow-card-hover)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "var(--shadow-card)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 9,
                background: "linear-gradient(135deg,#0071E3,#9333EA)",
                color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                  {c.projectCount} project{c.projectCount === 1 ? "" : "s"}
                  {c.accessMode === "restricted" && " · restricted"}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── My tasks (bucketed by due window) ── */

type BucketKey = "today" | "thisWeek" | "nextWeek" | "later" | "sometime" | "completed";

const BUCKETS: { key: BucketKey; label: string; emptyHint: string }[] = [
  { key: "today",     label: "Do Today",          emptyHint: "Nothing due today." },
  { key: "thisWeek",  label: "Do This Week",      emptyHint: "Nothing else due this week." },
  { key: "nextWeek",  label: "Do Next Week",      emptyHint: "Nothing scheduled for next week." },
  { key: "later",     label: "Do Later · Scheduled", emptyHint: "Nothing scheduled further out." },
  { key: "sometime",  label: "Do Sometime",       emptyHint: "Nothing undated." },
  { key: "completed", label: "Completed",         emptyHint: "No completed tasks yet." },
];

function todayStart() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function todayEnd()   { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }
function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d); m.setDate(d.getDate() + diff); m.setHours(0, 0, 0, 0); return m;
}
function endOfWeek(d: Date) {
  const s = startOfWeek(d); const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23, 59, 59, 999); return e;
}
function endDateMs(iso?: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
}

function TasksTabs({ data, users }: { data: { me: string; tasks: DashboardTask[] }; users: DirectoryUser[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "team" ? "team" : "mine";
  const [filterAssignee, setFilterAssignee] = useState<string>("");

  function setView(v: "mine" | "team") {
    const sp = new URLSearchParams(searchParams.toString());
    if (v === "mine") sp.delete("view");
    else sp.set("view", "team");
    router.replace(`/workspace${sp.toString() ? "?" + sp.toString() : ""}`, { scroll: false });
  }

  const predicate = useMemo(() => {
    if (view === "mine") {
      return (t: DashboardTask) => t.ownerEmail === data.me || t.collaborators.includes(data.me);
    }
    // Team view: every assigned task across the team, optionally filtered to one person
    return (t: DashboardTask) => {
      if (!t.ownerEmail) return false;
      if (filterAssignee && t.ownerEmail !== filterAssignee) return false;
      return true;
    };
  }, [view, data.me, filterAssignee]);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12, borderBottom: "1px solid var(--color-border)" }}>
        <TasksTab label="My tasks" active={view === "mine"} onClick={() => setView("mine")} />
        <TasksTab label="Team tasks" active={view === "team"} onClick={() => setView("team")} />
      </div>

      {view === "team" && users.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <PersonChip label="Everyone" active={filterAssignee === ""} onClick={() => setFilterAssignee("")} />
          {users.map((u) => (
            <PersonChip
              key={u.email}
              label={u.email === data.me ? `${u.label} (me)` : u.label}
              color={u.color}
              active={filterAssignee === u.email}
              onClick={() => setFilterAssignee(u.email)}
            />
          ))}
        </div>
      )}

      <TasksBuckets data={data} users={users} predicate={predicate} />
    </section>
  );
}

function TasksTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px",
        background: "transparent",
        border: "none",
        borderBottom: active ? "2px solid var(--color-accent)" : "2px solid transparent",
        color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
        fontWeight: active ? 600 : 500,
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "inherit",
        marginBottom: -1,
      }}
    >
      {label}
    </button>
  );
}

function PersonChip({ label, color, active, onClick }: { label: string; color?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 11px", borderRadius: 999,
        border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
        background: active ? "rgba(0,113,227,0.08)" : "transparent",
        color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
        fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {color && <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />}
      {label}
    </button>
  );
}

function TasksBuckets({
  data, users, predicate,
}: {
  data: { me: string; tasks: DashboardTask[] };
  users: DirectoryUser[];
  predicate: (t: DashboardTask) => boolean;
}) {
  const buckets = useMemo<Record<BucketKey, DashboardTask[]>>(() => {
    const todayEndMs = todayEnd().getTime();
    const thisWeekEndMs = endOfWeek(new Date()).getTime();
    const nextWeekStartMs = thisWeekEndMs + 1;
    const nextWeekEndMs = endOfWeek(new Date(nextWeekStartMs + 24 * 3600 * 1000)).getTime();

    const out: Record<BucketKey, DashboardTask[]> = { today: [], thisWeek: [], nextWeek: [], later: [], sometime: [], completed: [] };
    for (const t of data.tasks) {
      if (t.parentTaskId) continue;
      if (!predicate(t)) continue;
      if (t.completed) { out.completed.push(t); continue; }
      const due = endDateMs(t.endDate);
      if (due == null) out.sometime.push(t);
      else if (due <= todayEndMs) out.today.push(t);
      else if (due <= thisWeekEndMs) out.thisWeek.push(t);
      else if (due >= nextWeekStartMs && due <= nextWeekEndMs) out.nextWeek.push(t);
      else out.later.push(t);
    }
    const sortByDue = (a: DashboardTask, b: DashboardTask) => {
      const da = endDateMs(a.endDate) ?? Number.POSITIVE_INFINITY;
      const db = endDateMs(b.endDate) ?? Number.POSITIVE_INFINITY;
      return da - db;
    };
    out.today.sort(sortByDue);
    out.thisWeek.sort(sortByDue);
    out.nextWeek.sort(sortByDue);
    out.later.sort(sortByDue);
    out.sometime.sort(sortByDue);
    out.completed.sort((a, b) => {
      const da = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const db = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return db - da;
    });
    return out;
  }, [data, predicate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {BUCKETS.map((b) => (
        <BucketCard
          key={b.key}
          label={b.label}
          tasks={buckets[b.key]}
          users={users}
          emptyHint={b.emptyHint}
          variant={b.key}
        />
      ))}
    </div>
  );
}

function BucketCard({
  label, tasks, users, emptyHint, variant,
}: {
  label: string;
  tasks: DashboardTask[];
  users: DirectoryUser[];
  emptyHint: string;
  variant: BucketKey;
}) {
  const accent =
    variant === "today" ? "#DC2626" :
    variant === "thisWeek" ? "#0071E3" :
    variant === "nextWeek" ? "#A855F7" :
    variant === "later" ? "#6366F1" :
    variant === "sometime" ? "#94A3B8" :
    "#10B981";
  const todayMs = todayStart().getTime();
  const [open, setOpen] = useState(variant !== "completed" && variant !== "sometime" && variant !== "later");

  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 18, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 18px", width: "100%",
          background: "transparent", border: "none", cursor: "pointer",
          fontFamily: "inherit", textAlign: "left",
          borderBottom: open && tasks.length > 0 ? "1px solid var(--color-border)" : "none",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} />
        <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", background: "rgba(0,0,0,0.04)", padding: "2px 8px", borderRadius: 999 }}>
          {tasks.length}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-text-tertiary)" }}>
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        tasks.length === 0 ? (
          <div style={{ padding: "16px 18px", fontSize: 13, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
            {emptyHint}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {tasks.map((t) => (
              <BucketTaskRow key={t.id} task={t} users={users} todayMs={todayMs} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function BucketTaskRow({ task, users, todayMs }: { task: DashboardTask; users: DirectoryUser[]; todayMs: number }) {
  const router = useRouter();
  const allTags = useTags();
  const projectColor = colorForEmail(task.projectId);
  const due = endDateMs(task.endDate);
  const overdue = due != null && due < todayMs && !task.completed;
  const owner = userMeta(task.ownerEmail, users);

  function open() { router.push(`/workspace/${task.companyId}/${task.projectId}?task=${task.id}`); }
  async function toggleComplete(e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
    window.location.reload();
  }

  return (
    <div
      onClick={open}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 18px", borderTop: "1px solid var(--color-border)",
        cursor: "pointer", transition: "background 100ms var(--ease-apple)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <button
        onClick={toggleComplete}
        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
        style={{
          width: 18, height: 18, borderRadius: "50%",
          border: `1.5px solid ${task.completed ? "#10B981" : "var(--color-text-tertiary)"}`,
          background: task.completed ? "#10B981" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", padding: 0, flexShrink: 0,
        }}
      >
        {task.completed && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="5,12 10,17 19,7" /></svg>}
      </button>
      <span style={{
        flex: 1, fontSize: 14, minWidth: 0,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        color: task.completed ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
        textDecoration: task.completed ? "line-through" : "none",
      }}>
        {task.title}
      </span>
      {task.tagIds.length > 0 && (
        <TagPillList tagIds={task.tagIds} allTags={allTags} max={3} size="xs" />
      )}
      {task.priority && (
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: PRIORITY_META[task.priority].color, background: PRIORITY_META[task.priority].bg,
          padding: "3px 8px", borderRadius: 999, flexShrink: 0,
        }}>
          {PRIORITY_META[task.priority].label}
        </span>
      )}
      <span
        title={`${task.companyName} › ${task.projectName}`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 11, fontWeight: 500,
          padding: "3px 9px", borderRadius: 999,
          background: `${projectColor}1A`, color: projectColor,
          flexShrink: 0, maxWidth: 220,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: projectColor, flexShrink: 0 }} />
        {task.projectName}
      </span>
      {task.endDate && (
        <span style={{
          fontSize: 11, fontWeight: 500,
          padding: "3px 8px", borderRadius: 999,
          color: overdue ? "#B91C1C" : "var(--color-text-secondary)",
          background: overdue ? "#FEE2E2" : "transparent",
          flexShrink: 0,
        }}>
          {fmtDate(task.endDate)}
        </span>
      )}
      {owner && <Avatar user={owner} size={22} />}
    </div>
  );
}

/* ── Tasks I've assigned ── */

type AssignedTab = "this_week" | "upcoming" | "overdue" | "completed";

function AssignedByMe({ data, users }: { data: { me: string; tasks: DashboardTask[] }; users: DirectoryUser[] }) {
  const me = data.me;
  const assignedByMe = useMemo(
    () => data.tasks.filter((t) => t.createdByEmail === me && t.ownerEmail && t.ownerEmail !== me),
    [data.tasks, me],
  );
  const [tab, setTab] = useState<AssignedTab>("this_week");

  const buckets = useMemo(() => {
    const todayMs = todayStart().getTime();
    const weekEndMs = endOfWeek(new Date()).getTime();
    const upcoming: DashboardTask[] = [];
    const overdue: DashboardTask[] = [];
    const completed: DashboardTask[] = [];
    const this_week: DashboardTask[] = [];
    for (const t of assignedByMe) {
      if (t.parentTaskId) continue;
      if (t.completed) { completed.push(t); continue; }
      const due = endDateMs(t.endDate);
      if (due != null && due < todayMs) overdue.push(t);
      else upcoming.push(t);
      if (due != null && due >= todayMs && due <= weekEndMs) this_week.push(t);
    }
    const sortByDue = (a: DashboardTask, b: DashboardTask) => {
      const da = endDateMs(a.endDate) ?? Number.POSITIVE_INFINITY;
      const db = endDateMs(b.endDate) ?? Number.POSITIVE_INFINITY;
      return da - db;
    };
    upcoming.sort(sortByDue); overdue.sort(sortByDue); this_week.sort(sortByDue);
    completed.sort((a, b) => {
      const da = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const db = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return db - da;
    });
    return { upcoming, overdue, completed, this_week };
  }, [assignedByMe]);

  const TABS: { key: AssignedTab; label: string; count: number }[] = [
    { key: "this_week", label: "This week", count: buckets.this_week.length },
    { key: "upcoming",  label: "Upcoming",  count: buckets.upcoming.length },
    { key: "overdue",   label: "Overdue",   count: buckets.overdue.length },
    { key: "completed", label: "Completed", count: buckets.completed.length },
  ];
  const list = buckets[tab];

  return (
    <section style={{ background: "var(--bg-card)", borderRadius: 18, padding: "18px 20px", boxShadow: "var(--shadow-card)" }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>Tasks I&apos;ve assigned</h2>
      <div style={{ display: "flex", gap: 14, marginBottom: 8, borderBottom: "1px solid var(--color-border)" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "6px 0", background: "transparent", border: "none",
              borderBottom: tab === t.key ? "2px solid var(--color-text-primary)" : "2px solid transparent",
              color: tab === t.key ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              fontWeight: tab === t.key ? 600 : 500, fontSize: 12,
              cursor: "pointer", fontFamily: "inherit", marginBottom: -1,
            }}
          >
            {t.label} {t.count > 0 && <span style={{ color: tab === t.key ? "var(--color-text-secondary)" : "var(--color-text-tertiary)" }}>({t.count})</span>}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div style={{ padding: "16px 4px", fontSize: 13, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
          {tab === "completed" ? "No completed tasks here yet." : tab === "overdue" ? "Nothing overdue. Nice." : "You haven't assigned anything yet."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {list.map((t) => (
            <AssignedRow key={t.id} task={t} users={users} me={me} />
          ))}
        </div>
      )}
    </section>
  );
}

function AssignedRow({ task, users, me }: { task: DashboardTask; users: DirectoryUser[]; me: string }) {
  const router = useRouter();
  const allTags = useTags();
  const projectColor = colorForEmail(task.projectId);
  const due = endDateMs(task.endDate);
  const todayMs = todayStart().getTime();
  const overdue = due != null && due < todayMs && !task.completed;
  const owner = userMeta(task.ownerEmail, users);

  function open() { router.push(`/workspace/${task.companyId}/${task.projectId}?task=${task.id}`); }

  return (
    <div
      onClick={open}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 4px", borderTop: "1px solid var(--color-border)",
        cursor: "pointer", transition: "background 100ms var(--ease-apple)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{
        flex: 1, fontSize: 14, minWidth: 0,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        color: task.completed ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
        textDecoration: task.completed ? "line-through" : "none",
      }}>
        {task.title}
      </span>
      {task.tagIds.length > 0 && (
        <TagPillList tagIds={task.tagIds} allTags={allTags} max={3} size="xs" />
      )}
      <span
        title={`${task.companyName} › ${task.projectName}`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 11, fontWeight: 500,
          padding: "3px 9px", borderRadius: 999,
          background: `${projectColor}1A`, color: projectColor,
          flexShrink: 0, maxWidth: 220,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: projectColor, flexShrink: 0 }} />
        {task.projectName}
      </span>
      {task.endDate && (
        <span style={{
          fontSize: 11, fontWeight: 500,
          padding: "3px 8px", borderRadius: 999,
          color: overdue ? "#B91C1C" : "var(--color-text-secondary)",
          background: overdue ? "#FEE2E2" : "transparent",
          flexShrink: 0,
        }}>
          {fmtDate(task.endDate)}
        </span>
      )}
      {owner && owner.email !== me && <Avatar user={owner} size={22} />}
    </div>
  );
}

/* ── People widget ── */

type PeopleWindow = "this_week" | "this_month";

function PeopleWidget({ tasks, users }: { tasks: DashboardTask[]; users: DirectoryUser[] }) {
  const [windowKey, setWindowKey] = useState<PeopleWindow>("this_week");

  const stats = useMemo(() => {
    const today = todayStart();
    const winStart =
      windowKey === "this_week" ? startOfWeek(today) :
      new Date(today.getFullYear(), today.getMonth(), 1);
    const winEnd =
      windowKey === "this_week" ? endOfWeek(today) :
      new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const winStartMs = winStart.getTime();
    const winEndMs = winEnd.getTime();
    const todayMs = today.getTime();

    type Row = { email: string; overdue: number; completed: number; upcoming: number };
    const map = new Map<string, Row>();
    function bump(email: string | null | undefined): Row | null {
      if (!email) return null;
      const r = map.get(email) ?? { email, overdue: 0, completed: 0, upcoming: 0 };
      map.set(email, r);
      return r;
    }
    for (const t of tasks) {
      if (t.parentTaskId) continue;
      const r = bump(t.ownerEmail);
      if (!r) continue;
      const due = endDateMs(t.endDate);
      if (t.completed) {
        const completedAtMs = t.completedAt ? new Date(t.completedAt).getTime() : 0;
        if (completedAtMs >= winStartMs && completedAtMs <= winEndMs) r.completed++;
      } else {
        if (due != null && due < todayMs) r.overdue++;
        else if (due != null && due >= todayMs && due <= winEndMs) r.upcoming++;
      }
    }
    const rows = Array.from(map.values());
    rows.sort((a, b) => (b.overdue + b.upcoming + b.completed) - (a.overdue + a.upcoming + a.completed));
    return rows;
  }, [tasks, windowKey]);

  return (
    <section style={{ background: "var(--bg-card)", borderRadius: 18, padding: "18px 20px", boxShadow: "var(--shadow-card)" }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>People</h2>
      <div style={{ display: "flex", gap: 14, marginBottom: 8, borderBottom: "1px solid var(--color-border)" }}>
        {(["this_week", "this_month"] as const).map((w) => (
          <button
            key={w}
            onClick={() => setWindowKey(w)}
            style={{
              padding: "6px 0",
              background: "transparent", border: "none",
              borderBottom: windowKey === w ? "2px solid var(--color-text-primary)" : "2px solid transparent",
              color: windowKey === w ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              fontWeight: windowKey === w ? 600 : 500,
              fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginBottom: -1,
            }}
          >
            {w === "this_week" ? "This week" : "This month"}
          </button>
        ))}
      </div>
      {stats.length === 0 ? (
        <div style={{ padding: "16px 4px", fontSize: 13, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
          No tasks assigned to anyone yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {stats.map((s) => {
            const u = userMeta(s.email, users);
            return (
              <div key={s.email} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 4px", borderTop: "1px solid var(--color-border)",
              }}>
                <Avatar user={u} size={28} />
                <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {u?.label ?? s.email}
                </span>
                <Stat label="overdue" value={s.overdue} color="#B91C1C" bg="#FEE2E2" muted={s.overdue === 0} />
                <Stat label="completed" value={s.completed} color="#065F46" bg="#D1FAE5" muted={s.completed === 0} />
                <Stat label="upcoming" value={s.upcoming} color="var(--color-text-secondary)" bg="transparent" muted={s.upcoming === 0} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, color, bg, muted }: { label: string; value: number; color: string; bg: string; muted: boolean }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 500,
      padding: "3px 9px", borderRadius: 999,
      color: muted ? "var(--color-text-tertiary)" : color,
      background: muted ? "transparent" : bg,
      whiteSpace: "nowrap",
    }}>
      {value} {label}
    </span>
  );
}

/* ── New company modal ── */

function NewCompanyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || `HTTP ${res.status}`);
      }
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create");
      setSaving(false);
    }
  }

  return (
    <Modal title="New company" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "block", fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="e.g. Age Care Bathrooms"
          style={inputStyle}
          disabled={saving}
        />
        <label style={{ display: "block", fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this company do?"
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
          disabled={saving}
        />
        {err && <div style={{ fontSize: 12, color: "#B91C1C" }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button onClick={onClose} style={secondaryButtonStyle} disabled={saving}>Cancel</button>
          <button onClick={submit} style={primaryButtonStyle} disabled={saving || !name.trim()}>
            {saving ? "Creating…" : "Create company"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
