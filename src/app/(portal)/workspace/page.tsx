"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  DirectoryUser,
  colorForEmail,
  fmtDate,
  useUsers,
  userMeta,
} from "./_shared";
import { WorkspaceNav } from "./_nav";

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

export default function WorkspacePage() {
  const users = useUsers();

  return (
    <div style={{ padding: "32px 36px 64px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Workspace</h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
          Your tasks, your team, your projects.
        </p>
      </div>

      <WorkspaceNav current="dashboard" />

      <DashboardView users={users} />
    </div>
  );
}

/* ───────────────────────────────────────────────── */
/* Dashboard view                                    */
/* ───────────────────────────────────────────────── */

function DashboardView({ users }: { users: DirectoryUser[] }) {
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

  if (error) return <div style={{ padding: 16, background: "#FEE2E2", color: "#991B1B", borderRadius: 12, fontSize: 13 }}>{error}</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>Loading…</div>;

  const me = data.me;
  const myTasks = data.tasks.filter(
    (t) => t.ownerEmail === me || t.collaborators.includes(me),
  );
  const assignedByMe = data.tasks.filter(
    (t) => t.createdByEmail === me && t.ownerEmail && t.ownerEmail !== me,
  );

  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr" }}>
      <TasksWidget
        title="My tasks"
        emptyMessage="Nothing on your plate right now."
        tasks={myTasks}
        showAssignee={false}
        users={users}
        me={me}
      />
      <TasksWidget
        title="Tasks I've assigned"
        emptyMessage="You haven't assigned anything yet."
        tasks={assignedByMe}
        showAssignee
        users={users}
        me={me}
        includeThisWeek
      />
      <PeopleWidget tasks={data.tasks} users={users} />
    </div>
  );
}

/* ── Tasks widget (My tasks / Tasks I've assigned) ── */

type TaskTab = "this_week" | "upcoming" | "overdue" | "completed";

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
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
function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endDateMs(iso?: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
}

function TasksWidget({
  title, tasks, users, me, emptyMessage, showAssignee, includeThisWeek,
}: {
  title: string;
  tasks: DashboardTask[];
  users: DirectoryUser[];
  me: string;
  emptyMessage: string;
  showAssignee: boolean;
  includeThisWeek?: boolean;
}) {
  const [tab, setTab] = useState<TaskTab>(includeThisWeek ? "this_week" : "upcoming");

  const buckets = useMemo(() => {
    const today = todayStart().getTime();
    const weekEnd = endOfWeek(new Date()).getTime();
    const upcoming: DashboardTask[] = [];
    const overdue: DashboardTask[] = [];
    const completed: DashboardTask[] = [];
    const this_week: DashboardTask[] = [];
    for (const t of tasks) {
      if (t.parentTaskId) continue;
      if (t.completed) {
        completed.push(t);
        continue;
      }
      const due = endDateMs(t.endDate);
      if (due != null && due < today) overdue.push(t);
      else upcoming.push(t);
      if (due != null && due >= today && due <= weekEnd) this_week.push(t);
    }
    const sortByDue = (a: DashboardTask, b: DashboardTask) => {
      const da = endDateMs(a.endDate) ?? Number.POSITIVE_INFINITY;
      const db = endDateMs(b.endDate) ?? Number.POSITIVE_INFINITY;
      return da - db;
    };
    upcoming.sort(sortByDue);
    overdue.sort(sortByDue);
    this_week.sort(sortByDue);
    completed.sort((a, b) => {
      const da = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const db = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return db - da;
    });
    return { upcoming, overdue, completed, this_week };
  }, [tasks]);

  const TABS: { key: TaskTab; label: string; count: number }[] = [];
  if (includeThisWeek) TABS.push({ key: "this_week", label: "This week", count: buckets.this_week.length });
  TABS.push({ key: "upcoming", label: "Upcoming", count: buckets.upcoming.length });
  TABS.push({ key: "overdue", label: "Overdue", count: buckets.overdue.length });
  TABS.push({ key: "completed", label: "Completed", count: buckets.completed.length });

  const list = buckets[tab];

  return (
    <section style={{ background: "var(--bg-card)", borderRadius: 18, padding: "18px 20px", boxShadow: "var(--shadow-card)" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{title}</h2>
      </div>
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

      {list.length === 0 && (
        <div style={{ padding: "16px 4px", fontSize: 13, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
          {tab === "completed" ? "No completed tasks here yet." : tab === "overdue" ? "Nothing overdue. Nice." : emptyMessage}
        </div>
      )}

      {list.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {list.map((t) => (
            <DashboardTaskRow key={t.id} task={t} showAssignee={showAssignee} users={users} me={me} />
          ))}
        </div>
      )}
    </section>
  );
}

function DashboardTaskRow({
  task, users, me, showAssignee,
}: {
  task: DashboardTask;
  users: DirectoryUser[];
  me: string;
  showAssignee: boolean;
}) {
  const router = useRouter();
  const projectColor = colorForEmail(task.projectId);
  const due = endDateMs(task.endDate);
  const today = todayStart().getTime();
  const overdue = due != null && due < today && !task.completed;

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

  const owner = userMeta(task.ownerEmail, users);

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

      {showAssignee && owner && owner.email !== me && (
        <Avatar user={owner} size={22} />
      )}
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
    rows.sort((a, b) => {
      const ta = a.overdue + a.upcoming + a.completed;
      const tb = b.overdue + b.upcoming + b.completed;
      return tb - ta;
    });
    return rows;
  }, [tasks, windowKey]);

  return (
    <section style={{ background: "var(--bg-card)", borderRadius: 18, padding: "18px 20px", boxShadow: "var(--shadow-card)" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6, gap: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>People</h2>
      </div>
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
