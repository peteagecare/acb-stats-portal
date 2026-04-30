"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceNav } from "../_nav";
import {
  Avatar,
  DirectoryUser,
  PRIORITY_META,
  colorForEmail,
  fmtDate,
  useUsers,
  userMeta,
} from "../_shared";

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
}

type BucketKey = "today" | "thisWeek" | "nextWeek" | "sometime" | "completed";

const BUCKETS: { key: BucketKey; label: string; emptyHint: string }[] = [
  { key: "today",     label: "Do Today",     emptyHint: "Nothing due today." },
  { key: "thisWeek",  label: "Do This Week", emptyHint: "Nothing else due this week." },
  { key: "nextWeek",  label: "Do Next Week", emptyHint: "Nothing scheduled for next week." },
  { key: "sometime",  label: "Do Sometime",  emptyHint: "No undated or future-future tasks." },
  { key: "completed", label: "Completed",    emptyHint: "No completed tasks yet." },
];

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function todayEnd() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Mon
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}
function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function endDateMs(iso?: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
}

export default function MyTasksPage() {
  const users = useUsers();
  const [data, setData] = useState<{ me: string; tasks: DashboardTask[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workspace/dashboard", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { me: string; tasks: DashboardTask[] };
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const buckets = useMemo<Record<BucketKey, DashboardTask[]>>(() => {
    const empty = { today: [], thisWeek: [], nextWeek: [], sometime: [], completed: [] };
    if (!data) return empty;

    const me = data.me;
    const todayEndMs = todayEnd().getTime();
    const thisWeekEndMs = endOfWeek(new Date()).getTime();
    const nextWeekStartMs = thisWeekEndMs + 1;
    const nextWeekEndMs = endOfWeek(new Date(nextWeekStartMs + 24 * 3600 * 1000)).getTime();

    const out: Record<BucketKey, DashboardTask[]> = { today: [], thisWeek: [], nextWeek: [], sometime: [], completed: [] };

    for (const t of data.tasks) {
      if (t.parentTaskId) continue;
      // "My tasks" = I own OR I'm a collaborator
      if (t.ownerEmail !== me && !t.collaborators.includes(me)) continue;

      if (t.completed) {
        out.completed.push(t);
        continue;
      }
      const due = endDateMs(t.endDate);
      if (due == null) {
        out.sometime.push(t);
      } else if (due <= todayEndMs) {
        out.today.push(t); // includes overdue
      } else if (due <= thisWeekEndMs) {
        out.thisWeek.push(t);
      } else if (due >= nextWeekStartMs && due <= nextWeekEndMs) {
        out.nextWeek.push(t);
      } else {
        out.sometime.push(t); // further-future = sometime
      }
    }

    const sortByDue = (a: DashboardTask, b: DashboardTask) => {
      const da = endDateMs(a.endDate) ?? Number.POSITIVE_INFINITY;
      const db = endDateMs(b.endDate) ?? Number.POSITIVE_INFINITY;
      return da - db;
    };
    out.today.sort(sortByDue);
    out.thisWeek.sort(sortByDue);
    out.nextWeek.sort(sortByDue);
    out.sometime.sort(sortByDue);
    out.completed.sort((a, b) => {
      const da = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const db = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return db - da;
    });
    return out;
  }, [data]);

  return (
    <div style={{ padding: "32px 36px 64px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>My Tasks</h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
          Auto-organised by due date.
        </p>
      </div>

      <WorkspaceNav current="my-tasks" />

      {error && (
        <div style={{ padding: 16, background: "#FEE2E2", color: "#991B1B", borderRadius: 12, fontSize: 13 }}>
          {error}
        </div>
      )}
      {!data && !error && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>Loading…</div>
      )}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
      )}
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
    variant === "sometime" ? "#94A3B8" :
    "#10B981"; // completed

  const todayMs = todayStart().getTime();

  return (
    <section style={{ background: "var(--bg-card)", borderRadius: 18, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--color-border)" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} />
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{label}</h2>
        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", background: "rgba(0,0,0,0.04)", padding: "2px 8px", borderRadius: 999 }}>
          {tasks.length}
        </span>
      </header>

      {tasks.length === 0 ? (
        <div style={{ padding: "20px 18px", fontSize: 13, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
          {emptyHint}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {tasks.map((t) => (
            <BucketTaskRow key={t.id} task={t} users={users} todayMs={todayMs} />
          ))}
        </div>
      )}
    </section>
  );
}

function BucketTaskRow({
  task, users, todayMs,
}: {
  task: DashboardTask;
  users: DirectoryUser[];
  todayMs: number;
}) {
  const router = useRouter();
  const projectColor = colorForEmail(task.projectId);
  const due = endDateMs(task.endDate);
  const overdue = due != null && due < todayMs && !task.completed;
  const owner = userMeta(task.ownerEmail, users);

  function open() {
    router.push(`/workspace/${task.companyId}/${task.projectId}?task=${task.id}`);
  }

  async function toggleComplete(e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
    router.refresh();
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
