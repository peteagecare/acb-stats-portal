"use client";

import { use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Avatar,
  AvatarStack,
  DUE_STYLE,
  DirectoryUser,
  Modal,
  MultiUserPicker,
  PRIORITY_META,
  PROJECT_STATUS_META,
  colorForEmail,
  dueState,
  fmtDate,
  inputStyle,
  panelControlStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  upcomingQuarters,
  useUsers,
  userMeta,
} from "../../_shared";
import {
  Attachments,
  Comments,
  ProjectLinks,
  ProjectNotes,
  RichTextField,
} from "../../_collaboration";
import {
  TRACKER_STYLE,
  TrackerStatus,
  computeProjectTracker,
  computeTracker,
  rollupTaskStatuses,
} from "@/lib/tracker";
import { RecurrenceRule, formatISODate, formatRecurrence, nextOccurrence } from "@/lib/recurrence";
import { RecurrencePicker } from "../../_recurrence-picker";
import { TagFilterChips, TagPicker, TagPillList, useTags } from "../../_tags";
import { DatePicker, EnumPicker, UserPicker } from "@/app/components/Pickers";
import { useTimer } from "@/app/components/TimerProvider";
import { useFavourites } from "@/app/components/use-favourites";
import { useTaskContextMenu } from "../../_task-context-menu";
import { InlineTaskTitle } from "../../_inline-title";
import { MoveToButton } from "../../_move-to-button";

type ProjectStatus = "planning" | "active" | "on_hold" | "done" | "archived";
type Priority = "low" | "medium" | "high";

interface Section {
  id: string;
  projectId: string;
  name: string;
  order: number;
}

interface Task {
  id: string;
  projectId: string;
  sectionId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  ownerEmail: string | null;
  startDate: string | null;
  endDate: string | null;
  priority: Priority | null;
  estimatedHours: number | null;
  completed: boolean;
  completedAt: string | null;
  goal: string | null;
  expectedOutcome: string | null;
  recurrence: RecurrenceRule | null;
  recurrenceSourceId: string | null;
  order: number;
  createdAt: string;
  createdByEmail: string;
  collaborators: string[];
  tagIds: string[];
}

type ProjectType = "quarterly" | "initiative" | "ongoing";
type Department = "ppc" | "seo" | "content" | "web";

interface Project {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  notes: string | null;
  ownerEmail: string | null;
  startDate: string | null;
  endDate: string | null;
  status: ProjectStatus;
  type: ProjectType;
  department: Department | null;
  accessMode: "everyone" | "restricted";
  collaborators: string[];
  accessUsers: string[];
}

type Tab = "tasks" | "notes" | "files" | "links" | "comments";
type ProjectViewMode = "list" | "kanban" | "calendar" | "gantt";
const PROJECT_VIEW_KEY = "project-tasks-view";

const TABS: { key: Tab; label: string }[] = [
  { key: "tasks", label: "Tasks" },
  { key: "notes", label: "Notes" },
  { key: "files", label: "Files" },
  { key: "links", label: "Links" },
  { key: "comments", label: "Comments" },
];

interface ProjectPayload {
  project: Project;
  sections: Section[];
  tasks: Task[];
}

export default function ProjectPage({
  params,
}: {
  params: Promise<{ companyId: string; projectId: string }>;
}) {
  const { companyId, projectId } = use(params);
  const users = useUsers();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<ProjectPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Open task from ?task= param when data arrives
  useEffect(() => {
    const t = searchParams.get("task");
    if (t && data?.tasks.some((x) => x.id === t)) {
      setOpenTaskId(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.tasks.length, searchParams]);

  function closeTaskPanel() {
    setOpenTaskId(null);
    // strip ?task= from URL so refresh doesn't re-open
    if (searchParams.get("task")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("task");
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    }
  }
  const [filterAssignee, setFilterAssignee] = useState<string | "all">("all");
  const [trackerFilter, setTrackerFilter] = useState<TrackerStatus | "all">("all");
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(true);
  const [editingProject, setEditingProject] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<Tab>("tasks");
  const [me, setMe] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ProjectViewMode>("list");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(PROJECT_VIEW_KEY);
    if (stored === "list" || stored === "kanban" || stored === "calendar" || stored === "gantt") setViewMode(stored);
  }, []);

  function changeViewMode(next: ProjectViewMode) {
    setViewMode(next);
    if (typeof window !== "undefined") localStorage.setItem(PROJECT_VIEW_KEY, next);
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { email?: string } | null) => setMe(d?.email ?? null))
      .catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ProjectPayload;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const childrenByParent = useMemo(() => {
    const m = new Map<string, Task[]>();
    if (!data) return m;
    for (const t of data.tasks) {
      if (!t.parentTaskId) continue;
      const list = m.get(t.parentTaskId) ?? [];
      list.push(t);
      m.set(t.parentTaskId, list);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.order - b.order;
      });
    }
    return m;
  }, [data]);

  const tasksBySection = useMemo(() => {
    const grouped: Record<string, Task[]> = { unsectioned: [] };
    if (!data) return grouped;
    for (const s of data.sections) grouped[s.id] = [];
    for (const t of data.tasks) {
      if (t.parentTaskId) continue; // skip subtasks at top level
      if (filterAssignee !== "all") {
        const matches = t.ownerEmail === filterAssignee || t.collaborators.includes(filterAssignee);
        const unassignedFilter = filterAssignee === "" && !t.ownerEmail && t.collaborators.length === 0;
        if (!matches && !unassignedFilter) continue;
      }
      if (!showCompleted && t.completed) continue;
      if (trackerFilter !== "all") {
        const tr = computeTracker({
          startDate: t.startDate,
          endDate: t.endDate,
          completed: t.completed,
        });
        if (tr.status !== trackerFilter) continue;
      }
      if (tagFilter.size > 0) {
        // require at least one matching tag
        const hasMatch = t.tagIds.some((id) => tagFilter.has(id));
        if (!hasMatch) continue;
      }
      const key = t.sectionId ?? "unsectioned";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    }
    // A parent task floats to wherever its lowest-ordered child sits, so children
    // visually appear directly underneath the parent that owns them.
    const effectiveOrder = (t: Task) => {
      const kids = childrenByParent.get(t.id);
      if (!kids || kids.length === 0) return t.order;
      let min = t.order;
      for (const k of kids) if (k.order < min) min = k.order;
      return min;
    };
    for (const id of Object.keys(grouped)) {
      grouped[id].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return effectiveOrder(a) - effectiveOrder(b);
      });
    }
    return grouped;
  }, [data, filterAssignee, showCompleted, trackerFilter, tagFilter, childrenByParent]);

  const allProjectTasks = useMemo(() => (data ? data.tasks : ([] as Task[])), [data]);

  const counts = useMemo(() => {
    if (!data) return { open: 0, done: 0 };
    let open = 0; let done = 0;
    for (const t of data.tasks) {
      if (t.parentTaskId) continue;
      if (t.completed) done++; else open++;
    }
    return { open, done };
  }, [data]);

  const rollup = useMemo(() => {
    if (!data) return null;
    const taskResults = data.tasks
      .filter((t) => !t.parentTaskId)
      .map((t) => computeTracker({
        startDate: t.startDate,
        endDate: t.endDate,
        completed: t.completed,
      }));
    return rollupTaskStatuses(taskResults);
  }, [data]);

  const projectTracker = useMemo(() => {
    if (!data) return null;
    return computeProjectTracker(data.tasks, data.project.startDate, data.project.endDate);
  }, [data]);

  async function mutateApi(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error || `HTTP ${res.status}`);
    }
    await refresh();
    return res.json();
  }

  const openTask = data?.tasks.find((t) => t.id === openTaskId) ?? null;

  return (
    <div className="wsp-project" style={{ padding: "28px 32px 56px" }}>
      <nav style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>
        <Link href="/workspace" style={{ color: "inherit", textDecoration: "none" }}>Workspace</Link>
        {" / "}
        <Link href={`/workspace/${companyId}`} style={{ color: "inherit", textDecoration: "none" }}>Company</Link>
        {" / "}
        {data ? data.project.name : "…"}
      </nav>

      {error && (
        <div style={{ padding: 16, background: "#FEE2E2", color: "#991B1B", borderRadius: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {data && (
        <ProjectHeader
          project={data.project}
          counts={counts}
          rollup={rollup}
          projectTracker={projectTracker}
          users={users}
          onEdit={() => setEditingProject(true)}
        />
      )}

      {data && (
        <div style={{ display: "flex", gap: 4, marginTop: 20, marginBottom: 18, borderBottom: "1px solid var(--color-border)" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "10px 14px",
                background: "transparent",
                border: "none",
                borderBottom: tab === t.key ? "2px solid var(--color-accent)" : "2px solid transparent",
                color: tab === t.key ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                fontWeight: tab === t.key ? 600 : 500,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {data && tab === "tasks" && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
            <TaskFiltersDropdown
              users={users}
              filterAssignee={filterAssignee}
              setFilterAssignee={setFilterAssignee}
              showCompleted={showCompleted}
              setShowCompleted={setShowCompleted}
              trackerFilter={trackerFilter}
              setTrackerFilter={setTrackerFilter}
              rollup={rollup}
            />
            {(() => {
              const tagsInProject = new Set<string>();
              for (const t of data.tasks) for (const id of t.tagIds) tagsInProject.add(id);
              if (tagsInProject.size === 0) return null;
              return <TagFilterChips allTagIds={tagsInProject} active={tagFilter} onChange={setTagFilter} />;
            })()}
            <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
              <ProjectViewSwitcher value={viewMode} onChange={changeViewMode} />
              {viewMode === "list" && <AddSectionInline projectId={projectId} onCreated={refresh} />}
            </div>
          </div>

          {viewMode === "list" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {data.sections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  tasks={tasksBySection[section.id] ?? []}
                  users={users}
                  projectId={projectId}
                  sections={data.sections}
                  collapsed={!!collapsed[section.id]}
                  onToggleCollapse={() =>
                    setCollapsed((c) => ({ ...c, [section.id]: !c[section.id] }))
                  }
                  onOpenTask={setOpenTaskId}
                  onMutate={mutateApi}
                  canDelete={data.sections.length > 1}
                  childrenByParent={childrenByParent}
                  allProjectTasks={allProjectTasks}
                />
              ))}
              {(tasksBySection.unsectioned ?? []).length > 0 && (
                <SectionCard
                  key="unsectioned"
                  section={{ id: "unsectioned", projectId, name: "Unsectioned", order: 999 }}
                  tasks={tasksBySection.unsectioned}
                  users={users}
                  projectId={projectId}
                  sections={data.sections}
                  collapsed={!!collapsed.unsectioned}
                  onToggleCollapse={() =>
                    setCollapsed((c) => ({ ...c, unsectioned: !c.unsectioned }))
                  }
                  onOpenTask={setOpenTaskId}
                  onMutate={mutateApi}
                  canDelete={false}
                  isUnsectioned
                  childrenByParent={childrenByParent}
                  allProjectTasks={allProjectTasks}
                />
              )}
            </div>
          )}
          {viewMode === "kanban" && (
            <ProjectKanban
              sections={data.sections}
              tasksBySection={tasksBySection}
              users={users}
              projectId={projectId}
              onOpenTask={setOpenTaskId}
              onMutate={mutateApi}
            />
          )}
          {viewMode === "calendar" && (
            <ProjectCalendar
              tasks={data.tasks.filter((t) => !t.parentTaskId)}
              users={users}
              onOpenTask={setOpenTaskId}
            />
          )}
          {viewMode === "gantt" && (
            <ProjectGantt
              tasks={data.tasks.filter((t) => !t.parentTaskId)}
              sections={data.sections}
              users={users}
              onOpenTask={setOpenTaskId}
            />
          )}
        </>
      )}

      {data && tab === "notes" && (
        <div style={{ background: "var(--bg-card)", padding: 20, borderRadius: 18, boxShadow: "var(--shadow-card)" }}>
          <ProjectNotes projectId={projectId} initialNotes={data.project.notes} key={data.project.id} />
        </div>
      )}

      {data && tab === "files" && (
        <div style={{ background: "var(--bg-card)", padding: 20, borderRadius: 18, boxShadow: "var(--shadow-card)" }}>
          <Attachments parentType="project" parentId={projectId} users={users} />
        </div>
      )}

      {data && tab === "links" && (
        <div style={{ background: "var(--bg-card)", padding: 20, borderRadius: 18, boxShadow: "var(--shadow-card)" }}>
          <ProjectLinks projectId={projectId} />
        </div>
      )}

      {data && tab === "comments" && (
        <div style={{ background: "var(--bg-card)", padding: 20, borderRadius: 18, boxShadow: "var(--shadow-card)" }}>
          <Comments parentType="project" parentId={projectId} users={users} currentEmail={me} />
        </div>
      )}

      {openTask && data && (
        <TaskPanel
          key={openTask.id}
          task={openTask}
          sections={data.sections}
          users={users}
          currentEmail={me}
          onClose={closeTaskPanel}
          onMutate={mutateApi}
          allTasks={data.tasks}
          onOpenTask={setOpenTaskId}
        />
      )}

      {editingProject && data && (
        <EditProjectModal
          project={data.project}
          users={users}
          onClose={() => setEditingProject(false)}
          onSaved={() => { setEditingProject(false); refresh(); }}
        />
      )}
    </div>
  );
}

/* ── project header ─────────────────────────────────────────── */
function ProjectHeader({
  project, counts, rollup, projectTracker, users, onEdit,
}: {
  project: Project;
  counts: { open: number; done: number };
  rollup: ReturnType<typeof rollupTaskStatuses> | null;
  projectTracker: ReturnType<typeof computeProjectTracker> | null;
  users: DirectoryUser[];
  onEdit: () => void;
}) {
  const owner = userMeta(project.ownerEmail, users);
  const status = PROJECT_STATUS_META[project.status];
  const trackerStyle = projectTracker ? TRACKER_STYLE[projectTracker.status] : null;
  const { favourites, toggle } = useFavourites();
  const isPinned = favourites.has(project.id);
  return (
    <div style={{
      background: "var(--bg-card)", borderRadius: 18, padding: "20px 22px",
      boxShadow: "var(--shadow-card)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{project.name}</h1>
            <button
              onClick={() => toggle(project.id)}
              aria-label={isPinned ? "Unpin from favourites" : "Pin to favourites"}
              title={isPinned ? "Unpin from favourites" : "Pin to favourites"}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                padding: 4, display: "flex", alignItems: "center",
                color: isPinned ? "#EF4444" : "var(--color-text-tertiary)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
              color: status.color, background: status.bg,
            }}>{status.label}</span>
            {projectTracker && trackerStyle && projectTracker.status !== "unscheduled" && (
              <span
                title={`Project actual ${Math.round(projectTracker.actual * 100)}% vs expected ${Math.round(projectTracker.expected * 100)}%`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 11, fontWeight: 600,
                  padding: "2px 8px", borderRadius: 999,
                  color: trackerStyle.color, background: trackerStyle.bg,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: trackerStyle.dot }} />
                {projectTracker.label}
              </span>
            )}
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {counts.open} open · {counts.done} done
            </span>
          </div>
          {project.description && (
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 12px" }}>
              {project.description}
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", fontSize: 12, color: "var(--color-text-secondary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Owner</span>
              <Avatar user={owner} size={22} />
              <span style={{ color: "var(--color-text-primary)" }}>{owner?.label ?? "Unassigned"}</span>
            </div>
            {project.collaborators.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>Collaborators</span>
                <AvatarStack emails={project.collaborators} users={users} size={22} max={5} />
              </div>
            )}
            {(project.startDate || project.endDate) && (
              <div>
                <span>Dates</span>{" "}
                <span style={{ color: "var(--color-text-primary)" }}>
                  {fmtDate(project.startDate) ?? "—"} → {fmtDate(project.endDate) ?? "—"}
                </span>
              </div>
            )}
          </div>
        </div>
        <button onClick={onEdit} style={secondaryButtonStyle}>Edit project</button>
      </div>

      {rollup && rollup.total > 0 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
          <RollupBar rollup={rollup} />
        </div>
      )}
    </div>
  );
}

function RollupBar({ rollup }: { rollup: ReturnType<typeof rollupTaskStatuses> }) {
  const all: { key: TrackerStatus; count: number; label: string }[] = [
    { key: "overdue", count: rollup.overdue, label: "Overdue" },
    { key: "behind", count: rollup.behind, label: "Behind" },
    { key: "on_track", count: rollup.on_track, label: "On track" },
    { key: "ahead", count: rollup.ahead, label: "Ahead" },
    { key: "upcoming", count: rollup.upcoming, label: "Upcoming" },
    { key: "done", count: rollup.done, label: "Done" },
    { key: "unscheduled", count: rollup.unscheduled, label: "No schedule" },
  ];
  const segments = all.filter((s) => s.count > 0);

  return (
    <div>
      <div style={{ display: "flex", height: 6, borderRadius: 99, overflow: "hidden", background: "rgba(0,0,0,0.04)", marginBottom: 8 }}>
        {segments.map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${s.count}`}
            style={{
              flex: s.count,
              background: TRACKER_STYLE[s.key].dot,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: "var(--color-text-secondary)" }}>
        {segments.map((s) => (
          <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: TRACKER_STYLE[s.key].dot }} />
            {s.count} {s.label.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── tracker filter chip ────────────────────────────────────── */
function TrackerChip({
  label, active, count, statusKey, onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  statusKey?: TrackerStatus;
  onClick: () => void;
}) {
  const dot = statusKey ? TRACKER_STYLE[statusKey].dot : null;
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px", borderRadius: 999,
        background: active ? (statusKey ? TRACKER_STYLE[statusKey].bg : "rgba(0,113,227,0.1)") : "transparent",
        border: `1px solid ${active ? (statusKey ? TRACKER_STYLE[statusKey].dot : "#0071E3") : "var(--color-border)"}`,
        color: active ? (statusKey ? TRACKER_STYLE[statusKey].color : "#0071E3") : "var(--color-text-secondary)",
        fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot }} />}
      {label}
      <span style={{ fontWeight: 600, opacity: 0.7 }}>{count}</span>
    </button>
  );
}

/* ── filter chip ────────────────────────────────────────────── */
function FilterChip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string; }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 12px", borderRadius: 999,
        background: active ? (color ? `${color}1A` : "rgba(0,113,227,0.1)") : "transparent",
        border: `1px solid ${active ? (color ?? "#0071E3") : "var(--color-border)"}`,
        color: active ? (color ?? "#0071E3") : "var(--color-text-secondary)",
        fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {color && <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />}
      {label}
    </button>
  );
}

/* ── add section inline ─────────────────────────────────────── */
function AddSectionInline({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (!editing) {
    return <button onClick={() => setEditing(true)} style={primaryButtonStyle}>+ Add section</button>;
  }

  async function commit() {
    const v = name.trim();
    setEditing(false); setName("");
    if (!v) return;
    await fetch("/api/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, name: v }),
    });
    onCreated();
  }

  return (
    <input
      ref={ref}
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") { setName(""); setEditing(false); }
      }}
      placeholder="Section name"
      style={{
        padding: "6px 12px", borderRadius: 999, border: "1px solid var(--color-accent)",
        outline: "none", fontSize: 12, fontFamily: "inherit", minWidth: 180,
      }}
    />
  );
}

/* ── section card ───────────────────────────────────────────── */
function SectionCard({
  section, tasks, users, projectId, sections,
  collapsed, onToggleCollapse, onOpenTask, onMutate, canDelete, isUnsectioned,
  childrenByParent, allProjectTasks,
}: {
  section: Section;
  tasks: Task[];
  users: DirectoryUser[];
  projectId: string;
  sections: Section[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenTask: (id: string) => void;
  onMutate: (url: string, init: RequestInit) => Promise<unknown>;
  canDelete: boolean;
  isUnsectioned?: boolean;
  childrenByParent: Map<string, Task[]>;
  allProjectTasks: Task[];
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [editName, setEditName] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function onDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("application/x-task-id")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dropActive) setDropActive(true);
  }
  function onDragLeave(e: React.DragEvent) {
    // Only clear when actually leaving the section, not entering a child
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDropActive(false);
  }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropActive(false);
    const taskId = e.dataTransfer.getData("application/x-task-id");
    const fromSectionId = e.dataTransfer.getData("application/x-from-section");
    if (!taskId) return;
    const targetSectionId = isUnsectioned ? null : section.id;
    if ((fromSectionId || null) === (targetSectionId || null)) return;
    await onMutate(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId: targetSectionId }),
    });
  }

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  function startRename() { setEditName(section.name); setRenaming(true); }

  async function commitAdd(opts?: { keepFocus?: boolean }) {
    const title = draft.trim();
    if (!title) { setAdding(false); setDraft(""); return; }
    await onMutate("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        sectionId: isUnsectioned ? null : section.id,
        title,
      }),
    });
    setDraft("");
    if (opts?.keepFocus) inputRef.current?.focus();
    else setAdding(false);
  }

  async function commitRename() {
    const next = editName.trim();
    setRenaming(false);
    if (!next || next === section.name) return;
    await onMutate(`/api/sections/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    });
  }

  async function handleDelete() {
    if (!canDelete) return;
    if (!confirm(`Delete "${section.name}" and ${tasks.length} task${tasks.length === 1 ? "" : "s"}?`)) return;
    await onMutate(`/api/sections/${section.id}`, { method: "DELETE" });
  }

  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        background: "var(--bg-card)",
        borderRadius: 18,
        boxShadow: dropActive ? "0 0 0 2px var(--color-accent)" : "var(--shadow-card)",
        overflow: "hidden",
        transition: "box-shadow 120ms var(--ease-apple)",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: collapsed ? "none" : "1px solid var(--color-border)" }}>
        <button onClick={onToggleCollapse} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, color: "var(--color-text-secondary)", display: "flex" }} aria-label={collapsed ? "Expand" : "Collapse"}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 150ms var(--ease-apple)" }}>
            <polyline points="6,9 12,15 18,9" />
          </svg>
        </button>

        {renaming && !isUnsectioned ? (
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setRenaming(false);
            }}
            autoFocus
            style={{ fontSize: 16, fontWeight: 600, border: "1px solid var(--color-border)", borderRadius: 8, padding: "4px 8px", fontFamily: "inherit", minWidth: 200 }}
          />
        ) : (
          <button
            onClick={isUnsectioned ? undefined : startRename}
            style={{ background: "transparent", border: "none", padding: 0, cursor: isUnsectioned ? "default" : "text", fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", fontFamily: "inherit" }}
            title={isUnsectioned ? undefined : "Click to rename"}
          >
            {section.name}
          </button>
        )}
        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", background: "rgba(0,0,0,0.04)", padding: "2px 8px", borderRadius: 999 }}>
          {tasks.length}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {!collapsed && (
            <button onClick={() => setAdding(true)} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, background: "transparent", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
              + Add task
            </button>
          )}
          {canDelete && !isUnsectioned && (
            <button onClick={handleDelete} style={{ background: "transparent", border: "none", color: "var(--color-text-tertiary)", cursor: "pointer", padding: 4, display: "flex" }} aria-label="Delete section">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {!collapsed && (
        <div>
          {tasks.length === 0 && !adding && (
            <div style={{ padding: "20px 18px", fontSize: 13, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>No tasks yet.</div>
          )}

          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              users={users}
              sections={sections}
              onOpenTask={onOpenTask}
              onMutate={onMutate}
              childrenByParent={childrenByParent}
              allProjectTasks={allProjectTasks}
            />
          ))}

          {adding ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderTop: "1px solid var(--color-border)", background: "rgba(0,113,227,0.03)" }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid var(--color-text-tertiary)", flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a task name and press Enter (or click off to save)"
                onBlur={() => commitAdd()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitAdd({ keepFocus: true }); }
                  if (e.key === "Escape") { setAdding(false); setDraft(""); }
                }}
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, fontFamily: "inherit", color: "var(--color-text-primary)" }}
              />
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", width: "100%", background: "transparent", border: "none", borderTop: tasks.length ? "1px solid var(--color-border)" : "none", cursor: "pointer", fontFamily: "inherit", color: "var(--color-text-tertiary)", fontSize: 13, textAlign: "left" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              + Add task
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/* ── task row ───────────────────────────────────────────────── */
function TaskRow({
  task, users, sections, onOpenTask, onMutate, childrenByParent, allProjectTasks, depth = 0,
}: {
  task: Task;
  users: DirectoryUser[];
  sections: Section[];
  onOpenTask: (id: string) => void;
  onMutate: (url: string, init: RequestInit) => Promise<unknown>;
  childrenByParent: Map<string, Task[]>;
  allProjectTasks: Task[];
  depth?: number;
}) {
  const allTags = useTags();
  const owner = userMeta(task.ownerEmail, users);
  const dStat = dueState(task.endDate);
  const dueLabel = fmtDate(task.endDate);
  const tracker = computeTracker({
    startDate: task.startDate,
    endDate: task.endDate,
    completed: task.completed,
  });
  const showTrackerBadge =
    !task.completed &&
    (tracker.status === "behind" || tracker.status === "overdue" || tracker.status === "ahead");
  const trackerStyle = TRACKER_STYLE[tracker.status];

  const childTasks = childrenByParent.get(task.id) ?? [];
  const hasChildren = childTasks.length > 0;
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const { onContextMenu: onContextMenuRow, menu: contextMenu } = useTaskContextMenu({
    taskTitle: task.title,
    currentStartDate: task.startDate,
    currentEndDate: task.endDate,
    currentRecurrence: task.recurrence,
    currentProjectId: task.projectId,
    currentSectionId: task.sectionId,
    onDelete: async () => {
      await onMutate(`/api/tasks/${task.id}`, { method: "DELETE" });
    },
    onUpdate: async (patch) => {
      await onMutate(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    },
  });

  async function toggleComplete(e: React.MouseEvent) {
    e.stopPropagation();
    await onMutate(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
  }

  async function moveUnder(parentId: string | null) {
    setMenuOpen(false);
    await onMutate(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentTaskId: parentId }),
    });
  }

  // Valid parents = any task in the project except self + own descendants (prevents cycles)
  const parentCandidates = useMemo(() => {
    const excluded = new Set<string>([task.id]);
    let added = true;
    while (added) {
      added = false;
      for (const t of allProjectTasks) {
        if (t.parentTaskId && excluded.has(t.parentTaskId) && !excluded.has(t.id)) {
          excluded.add(t.id);
          added = true;
        }
      }
    }
    return allProjectTasks.filter((t) => !excluded.has(t.id));
  }, [allProjectTasks, task.id]);

  return (
    <>
    <div
      onClick={() => onOpenTask(task.id)}
      onContextMenu={onContextMenuRow}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-task-id", task.id);
        e.dataTransfer.setData("application/x-from-section", task.sectionId ?? "");
        e.currentTarget.style.opacity = "0.5";
      }}
      onDragEnd={(e) => { e.currentTarget.style.opacity = "1"; }}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 18px", paddingLeft: 18 + depth * 22,
        borderTop: "1px solid var(--color-border)",
        cursor: "grab", transition: "background 100ms var(--ease-apple)",
        background: hovered ? "rgba(0,0,0,0.02)" : "transparent",
      }}
    >
      {hasChildren ? (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
          style={{
            width: 18, height: 18, padding: 0, marginRight: -2,
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--color-text-secondary)", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 120ms var(--ease-apple)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <polyline points="9,6 15,12 9,18" />
          </svg>
        </button>
      ) : (
        <span style={{ width: 16, flexShrink: 0 }} />
      )}

      <button onClick={toggleComplete} aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
        style={{ width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${task.completed ? "#10B981" : "var(--color-text-tertiary)"}`, background: task.completed ? "#10B981" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, flexShrink: 0, transition: "all 120ms var(--ease-apple)" }}
      >
        {task.completed && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="5,12 10,17 19,7" /></svg>}
      </button>

      <InlineTaskTitle
        title={task.title}
        completed={task.completed}
        fontSize={14}
        onSingleClick={() => onOpenTask(task.id)}
        onSave={async (next) => {
          await onMutate(`/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: next }),
          });
        }}
      />

      {showTrackerBadge && (
        <span
          title={`${Math.round(tracker.actual * 100)}% done vs ${Math.round(tracker.expected * 100)}% expected`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 600,
            padding: "3px 8px", borderRadius: 999,
            color: trackerStyle.color, background: trackerStyle.bg,
            flexShrink: 0,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: trackerStyle.dot }} />
          {tracker.label}
        </span>
      )}

      {task.recurrence && (
        <span
          title={formatRecurrence(task.recurrence)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 500,
            color: "#7C3AED", background: "rgba(124, 58, 237, 0.1)",
            padding: "3px 8px", borderRadius: 999, flexShrink: 0,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          Repeats
        </span>
      )}

      {task.tagIds.length > 0 && (
        <TagPillList tagIds={task.tagIds} allTags={allTags} max={3} size="xs" />
      )}

      {task.priority && (
        <span style={{ fontSize: 11, fontWeight: 600, color: PRIORITY_META[task.priority].color, background: PRIORITY_META[task.priority].bg, padding: "3px 8px", borderRadius: 999, flexShrink: 0 }}>
          {PRIORITY_META[task.priority].label}
        </span>
      )}

      {typeof task.estimatedHours === "number" && (
        <span style={{ fontSize: 11, color: "var(--color-text-secondary)", flexShrink: 0 }}>
          {task.estimatedHours}h
        </span>
      )}

      {dueLabel && dStat && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, color: DUE_STYLE[dStat].color, background: DUE_STYLE[dStat].bg, padding: "3px 8px", borderRadius: 999, flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>
          {dueLabel}
        </span>
      )}

      {task.collaborators.length > 0 && (
        <AvatarStack emails={task.collaborators} users={users} size={20} max={3} />
      )}

      <Avatar user={owner} size={24} />

      <MoveToButton
        currentProjectId={task.projectId}
        currentSectionId={task.sectionId}
        onMove={async (projectId, sectionId) => {
          await onMutate(`/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(projectId !== task.projectId ? { projectId } : {}),
              sectionId,
            }),
          });
        }}
      />

      <div
        style={{
          opacity: hovered || menuOpen ? 1 : 0,
          transition: "opacity 120ms var(--ease-apple)",
          pointerEvents: hovered || menuOpen ? "auto" : "none",
          flexShrink: 0,
        }}
      >
        <button
          ref={menuButtonRef}
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          aria-label="Move under parent"
          title="Move under parent"
          style={{
            width: 22, height: 22, borderRadius: 6,
            background: menuOpen ? "rgba(0,113,227,0.1)" : "transparent",
            border: "none", cursor: "pointer",
            color: menuOpen ? "var(--color-accent)" : "var(--color-text-secondary)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9,10 4,15 9,20" />
            <path d="M20 4v7a4 4 0 01-4 4H4" />
          </svg>
        </button>
        {menuOpen && (
          <ParentPickerPopover
            anchor={menuButtonRef.current}
            taskHasParent={!!task.parentTaskId}
            currentParentId={task.parentTaskId}
            candidates={parentCandidates}
            onClose={() => setMenuOpen(false)}
            onPick={(parentId) => moveUnder(parentId)}
          />
        )}
      </div>
    </div>
    {contextMenu}
    {hasChildren && expanded && childTasks.map((child) => (
      <TaskRow
        key={child.id}
        task={child}
        users={users}
        sections={sections}
        onOpenTask={onOpenTask}
        onMutate={onMutate}
        childrenByParent={childrenByParent}
        allProjectTasks={allProjectTasks}
        depth={depth + 1}
      />
    ))}
    </>
  );
}

/* ── parent picker popover (portaled to body so it escapes overflow) ── */
function ParentPickerPopover({
  anchor, taskHasParent, currentParentId, candidates, onClose, onPick,
}: {
  anchor: HTMLElement | null;
  taskHasParent: boolean;
  currentParentId: string | null;
  candidates: Task[];
  onClose: () => void;
  onPick: (parentId: string | null) => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; openUp: boolean } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!anchor) return;
    function update() {
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const POPOVER_W = 280;
      const POPOVER_MAX_H = 320;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < POPOVER_MAX_H + 16 && rect.top > POPOVER_MAX_H + 16;
      const top = openUp ? rect.top - POPOVER_MAX_H - 6 : rect.bottom + 6;
      const left = Math.min(
        Math.max(8, rect.right - POPOVER_W),
        window.innerWidth - POPOVER_W - 8,
      );
      setPos({ top, left, openUp });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined" || !pos) return null;
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000 }} />
      <div
        ref={popoverRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: pos.top, left: pos.left,
          width: 280,
          maxHeight: 320, overflowY: "auto",
          background: "white", borderRadius: 10,
          border: "1px solid var(--color-border)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
          padding: 4, zIndex: 1001,
        }}
      >
        <div style={{ padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Make subtask of
        </div>
        {taskHasParent && (
          <button
            onClick={() => onPick(null)}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "7px 10px", borderRadius: 6,
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 12, fontFamily: "inherit",
              color: "var(--color-text-secondary)",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            ↑ Detach (back to top level)
          </button>
        )}
        {candidates.length === 0 ? (
          <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
            No other top-level tasks.
          </div>
        ) : (
          candidates.map((p) => {
            const active = p.id === currentParentId;
            return (
              <button
                key={p.id}
                onClick={() => { if (!active) onPick(p.id); }}
                disabled={active}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "7px 10px", borderRadius: 6,
                  background: active ? "rgba(0,113,227,0.08)" : "transparent",
                  border: "none", cursor: active ? "default" : "pointer",
                  fontSize: 13, fontFamily: "inherit",
                  color: active ? "var(--color-accent)" : "var(--color-text-primary)",
                  fontWeight: active ? 600 : 400,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                {p.title}
              </button>
            );
          })
        )}
      </div>
    </>,
    document.body,
  );
}

/* ── Subtasks section (used inside the TaskPanel; recursive) ── */
function SubtasksSection({
  parentTask, allTasks, users, onOpenTask, onMutate,
}: {
  parentTask: Task;
  allTasks: Task[];
  users: DirectoryUser[];
  onOpenTask: (id: string) => void;
  onMutate: (url: string, init: RequestInit) => Promise<unknown>;
}) {
  const directChildren = useMemo(
    () => allTasks
      .filter((t) => t.parentTaskId === parentTask.id)
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.order - b.order;
      }),
    [allTasks, parentTask.id],
  );
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  async function commitAdd(opts?: { keepFocus?: boolean }) {
    const v = draft.trim();
    if (!v) { setAdding(false); setDraft(""); return; }
    await onMutate("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: parentTask.projectId,
        sectionId: parentTask.sectionId,
        parentTaskId: parentTask.id,
        title: v,
      }),
    });
    setDraft("");
    if (opts?.keepFocus) inputRef.current?.focus();
    else setAdding(false);
  }

  return (
    <div style={{ marginTop: 6, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>
          Subtasks
        </h3>
        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--color-text-tertiary)", background: "rgba(0,0,0,0.04)", padding: "2px 7px", borderRadius: 999 }}>
          {directChildren.length}
        </span>
        <button
          onClick={() => setAdding(true)}
          style={{
            marginLeft: "auto",
            padding: "3px 9px",
            background: "rgba(0,113,227,0.1)", color: "var(--color-accent)",
            border: "none", borderRadius: 7, cursor: "pointer",
            fontSize: 11, fontWeight: 600, fontFamily: "inherit",
          }}
        >+ Add subtask</button>
      </div>

      {directChildren.length === 0 && !adding && (
        <div style={{ padding: "8px 4px", fontSize: 12, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
          No subtasks yet.
        </div>
      )}

      {directChildren.map((c) => (
        <SubtaskRow
          key={c.id}
          task={c}
          allTasks={allTasks}
          users={users}
          onOpenTask={onOpenTask}
          onMutate={onMutate}
          depth={0}
        />
      ))}

      {adding && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "rgba(0,113,227,0.05)", borderRadius: 8, marginTop: 4 }}>
          <span style={{ width: 16, height: 16, borderRadius: "50%", border: "1.5px solid var(--color-text-tertiary)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitAdd()}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitAdd({ keepFocus: true }); }
              if (e.key === "Escape") { setAdding(false); setDraft(""); }
            }}
            placeholder="Subtask title… (Enter or click off to save)"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, fontFamily: "inherit" }}
          />
        </div>
      )}
    </div>
  );
}

function SubtaskRow({
  task, allTasks, users, onOpenTask, onMutate, depth,
}: {
  task: Task;
  allTasks: Task[];
  users: DirectoryUser[];
  onOpenTask: (id: string) => void;
  onMutate: (url: string, init: RequestInit) => Promise<unknown>;
  depth: number;
}) {
  const owner = userMeta(task.ownerEmail, users);
  const grandchildren = allTasks.filter((t) => t.parentTaskId === task.id);
  const hasChildren = grandchildren.length > 0;
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  async function toggleComplete(e: React.MouseEvent) {
    e.stopPropagation();
    await onMutate(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
  }

  async function commitAdd(opts?: { keepFocus?: boolean }) {
    const v = draft.trim();
    if (!v) { setAdding(false); setDraft(""); return; }
    await onMutate("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: task.projectId,
        sectionId: task.sectionId,
        parentTaskId: task.id,
        title: v,
      }),
    });
    setDraft("");
    if (opts?.keepFocus) inputRef.current?.focus();
    else setAdding(false);
  }

  return (
    <div style={{ marginLeft: depth * 18 }}>
      <div
        onClick={() => onOpenTask(task.id)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 8px", borderRadius: 8,
          cursor: "pointer", transition: "background 100ms var(--ease-apple)",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.03)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            aria-label={expanded ? "Collapse" : "Expand"}
            style={{
              width: 16, height: 16, padding: 0,
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--color-text-secondary)", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 120ms var(--ease-apple)",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <polyline points="9,6 15,12 9,18" />
            </svg>
          </button>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <button
          onClick={toggleComplete}
          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
          style={{
            width: 16, height: 16, borderRadius: "50%",
            border: `1.5px solid ${task.completed ? "#10B981" : "var(--color-text-tertiary)"}`,
            background: task.completed ? "#10B981" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0, flexShrink: 0,
          }}
        >
          {task.completed && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="5,12 10,17 19,7" /></svg>}
        </button>
        <InlineTaskTitle
          title={task.title}
          completed={task.completed}
          fontSize={13}
          onSingleClick={() => onOpenTask(task.id)}
          onSave={async (next) => {
            await onMutate(`/api/tasks/${task.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: next }),
            });
          }}
        />
        <MoveToButton
          currentProjectId={task.projectId}
          currentSectionId={task.sectionId}
          onMove={async (projectId, sectionId) => {
            await onMutate(`/api/tasks/${task.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...(projectId !== task.projectId ? { projectId } : {}),
                sectionId,
              }),
            });
          }}
        />
        <button
          onClick={(e) => { e.stopPropagation(); setAdding(true); }}
          aria-label="Add subtask"
          title="Add subtask"
          style={{
            width: 22, height: 22, borderRadius: 6,
            background: "transparent", color: "var(--color-text-tertiary)",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.06)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        {owner && <Avatar user={owner} size={20} />}
      </div>

      {hasChildren && expanded && (
        <div style={{ marginLeft: 14, paddingLeft: 4, borderLeft: "1px solid var(--color-border)" }}>
          {grandchildren.map((g) => (
            <SubtaskRow
              key={g.id}
              task={g}
              allTasks={allTasks}
              users={users}
              onOpenTask={onOpenTask}
              onMutate={onMutate}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {adding && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 8px", marginLeft: 30,
          background: "rgba(0,113,227,0.05)", borderRadius: 8, marginTop: 2,
        }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid var(--color-text-tertiary)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitAdd()}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitAdd({ keepFocus: true }); }
              if (e.key === "Escape") { setAdding(false); setDraft(""); }
            }}
            placeholder="Subtask title… (Enter or click off to save)"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 12, fontFamily: "inherit" }}
          />
        </div>
      )}
    </div>
  );
}

/* ── task panel ─────────────────────────────────────────────── */
function TaskPanel({
  task, sections, users, currentEmail, onClose, onMutate, allTasks, onOpenTask,
}: {
  task: Task;
  sections: Section[];
  users: DirectoryUser[];
  currentEmail: string | null;
  onClose: () => void;
  onMutate: (url: string, init: RequestInit) => Promise<unknown>;
  allTasks: Task[];
  onOpenTask: (id: string) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [goal, setGoal] = useState(task.goal ?? "");
  const [outcome, setOutcome] = useState(task.expectedOutcome ?? "");

  const tracker = computeTracker({
    startDate: task.startDate,
    endDate: task.endDate,
    completed: task.completed,
  });
  const trackerStyle = TRACKER_STYLE[tracker.status];

  const baseUrl = `/api/tasks/${task.id}`;

  async function patch(p: object) {
    await onMutate(baseUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
  }

  async function commitTitle() {
    const v = title.trim();
    if (!v || v === task.title) { setTitle(task.title); return; }
    await patch({ title: v });
  }
  async function commitGoal() {
    if (goal === (task.goal ?? "")) return;
    await patch({ goal });
  }
  async function commitOutcome() {
    if (outcome === (task.expectedOutcome ?? "")) return;
    await patch({ expectedOutcome: outcome });
  }
  async function handleDelete() {
    if (!confirm(`Delete "${task.title}"?`)) return;
    await onMutate(baseUrl, { method: "DELETE" });
    onClose();
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, height: "100%", background: "white", boxShadow: "var(--shadow-modal)", padding: "20px 24px 24px", overflowY: "auto", animation: "slideIn 220ms var(--ease-apple)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <button
            onClick={() => patch({ completed: !task.completed })}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, background: task.completed ? "#D1FAE5" : "transparent", border: `1px solid ${task.completed ? "#10B981" : "var(--color-border)"}`, color: task.completed ? "#065F46" : "var(--color-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="4,12 9,17 20,6" /></svg>
            {task.completed ? "Completed" : "Mark complete"}
          </button>
          {tracker.status !== "unscheduled" && (
            <span
              title={`Actual ${Math.round(tracker.actual * 100)}% · Expected ${Math.round(tracker.expected * 100)}%`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, fontWeight: 600,
                padding: "5px 10px", borderRadius: 999,
                color: trackerStyle.color, background: trackerStyle.bg,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: trackerStyle.dot }} />
              {tracker.label}
            </span>
          )}
          <button onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", padding: 6, color: "var(--color-text-secondary)", display: "flex" }} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          style={{ width: "100%", fontSize: 22, fontWeight: 600, border: "none", outline: "none", padding: "4px 0 12px", color: "var(--color-text-primary)", fontFamily: "inherit", background: "transparent" }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "132px 1fr", rowGap: 4, columnGap: 12, alignItems: "center", marginTop: 4, marginBottom: 18 }}>
          <PanelLabel>Owner</PanelLabel>
          <OwnerSelect
            value={task.ownerEmail}
            users={users}
            onChange={(v) => patch({ ownerEmail: v })}
          />

          <PanelLabel topAlign>Collaborators</PanelLabel>
          <div style={{ padding: "4px 0" }}>
            <MultiUserPicker selected={task.collaborators} users={users} onChange={(next) => patch({ setCollaborators: next })} exclude={task.ownerEmail} />
          </div>

          <PanelLabel>Start date</PanelLabel>
          <DatePicker
            value={task.startDate}
            onChange={(iso) => patch({ startDate: iso })}
          >
            {({ onClick, ref }) => (
              <button
                ref={ref}
                onClick={onClick}
                type="button"
                className="task-panel-control"
                style={{ ...panelControlStyle, textAlign: "left" }}
              >
                {task.startDate ? formatPanelDate(task.startDate) : <span style={{ color: "var(--color-text-tertiary)" }}>—</span>}
              </button>
            )}
          </DatePicker>

          <PanelLabel>End date</PanelLabel>
          <DatePicker
            value={task.endDate}
            onChange={(iso) => patch({ endDate: iso })}
          >
            {({ onClick, ref }) => (
              <button
                ref={ref}
                onClick={onClick}
                type="button"
                className="task-panel-control"
                style={{ ...panelControlStyle, textAlign: "left" }}
              >
                {task.endDate ? formatPanelDate(task.endDate) : <span style={{ color: "var(--color-text-tertiary)" }}>—</span>}
              </button>
            )}
          </DatePicker>

          <PanelLabel>Priority</PanelLabel>
          <PillSelect
            value={task.priority ?? ""}
            onChange={(v) => patch({ priority: (v || null) as Priority | null })}
            options={[
              { value: "", label: "None", bg: "transparent", color: "var(--color-text-tertiary)" },
              { value: "low", label: "Low", bg: "#E0E7FF", color: "#3730A3" },
              { value: "medium", label: "Medium", bg: "#FEF3C7", color: "#92400E" },
              { value: "high", label: "High", bg: "#FEE2E2", color: "#991B1B" },
            ]}
          />

          <PanelLabel>Est. time</PanelLabel>
          <EstTimeInput
            valueHours={task.estimatedHours}
            onChange={(next) => patch({ estimatedHours: next })}
            taskId={task.id}
            taskTitle={task.title}
          />

          <PanelLabel>Section</PanelLabel>
          <EnumPicker
            selected={task.sectionId ?? ""}
            options={[
              { value: "", label: "Unsectioned" },
              ...sections.map((s) => ({ value: s.id, label: s.name })),
            ]}
            onChange={(v) => patch({ sectionId: v || null })}
          >
            {({ onClick, ref }) => (
              <button
                ref={ref}
                onClick={onClick}
                type="button"
                className="task-panel-control"
                style={{ ...panelControlStyle, textAlign: "left" }}
              >
                {sections.find((s) => s.id === task.sectionId)?.name ?? <span style={{ color: "var(--color-text-tertiary)" }}>Unsectioned</span>}
              </button>
            )}
          </EnumPicker>

          <PanelLabel topAlign>Repeats</PanelLabel>
          <div style={{ padding: "4px 0" }}>
            <RecurrencePicker
              value={task.recurrence}
              onChange={(next) => {
                // Whenever the rule changes, re-seed the due date with the
                // next matching occurrence (e.g. switching Thu→Fri should
                // update the deadline to next Fri). Clearing the rule leaves
                // the existing deadline alone.
                if (next) {
                  const seed = nextOccurrence(next, new Date());
                  if (seed) {
                    patch({ recurrence: next, endDate: formatISODate(seed) });
                    return;
                  }
                }
                patch({ recurrence: next });
              }}
            />
          </div>

          <PanelLabel topAlign>Tags</PanelLabel>
          <div style={{ padding: "4px 0" }}>
            <TagPicker
              selected={task.tagIds}
              onChange={(next) => patch({ setTagIds: next })}
            />
          </div>
        </div>

        <SubtasksSection
          parentTask={task}
          allTasks={allTasks}
          users={users}
          onOpenTask={onOpenTask}
          onMutate={onMutate}
        />

        <Field label="Description">
          <RichTextField
            key={task.id}
            initialHtml={task.description ?? ""}
            parentType="task"
            parentId={task.id}
            placeholder="Add a description, links, or context… (paste images)"
            onCommit={async (html) => {
              await patch({ description: html });
            }}
          />
        </Field>
        <div style={{ height: 12 }} />
        <Field label="Goal (optional)">
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} onBlur={commitGoal} rows={2} placeholder="What does success look like?" style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
        <div style={{ height: 12 }} />
        <Field label="Expected outcome (optional)">
          <textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} onBlur={commitOutcome} rows={2} placeholder="Concrete result of completing this task" style={{ ...inputStyle, resize: "vertical" }} />
        </Field>

        <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px", color: "var(--color-text-primary)" }}>Files</h3>
          <Attachments parentType="task" parentId={task.id} users={users} />
        </div>

        <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px", color: "var(--color-text-primary)" }}>Comments</h3>
          <Comments parentType="task" parentId={task.id} users={users} currentEmail={currentEmail} />
        </div>

        <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--color-border)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
          Created {new Date(task.createdAt).toLocaleString()} by {task.createdByEmail}
          {task.completedAt && <> · Completed {new Date(task.completedAt).toLocaleString()}</>}
        </div>

        <button onClick={handleDelete} style={{ marginTop: 18, padding: "8px 14px", borderRadius: 10, background: "transparent", border: "1px solid #FCA5A5", color: "#B91C1C", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
          Delete task
        </button>
      </div>
    </div>
  );
}

function PanelLabel({ children, topAlign }: { children: React.ReactNode; topAlign?: boolean }) {
  return (
    <span
      style={{
        fontSize: 12,
        color: "var(--color-text-tertiary)",
        alignSelf: topAlign ? "start" : "center",
        paddingTop: topAlign ? 10 : 0,
      }}
    >
      {children}
    </span>
  );
}

function userInitial(label: string): string {
  return (label || "?").trim().slice(0, 1).toUpperCase();
}

function formatPanelDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) return iso;
  const today = new Date();
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function OwnerSelect({
  value, users, onChange,
}: {
  value: string | null;
  users: DirectoryUser[];
  onChange: (next: string | null) => void;
}) {
  const owner = users.find((u) => u.email === value) ?? null;
  return (
    <UserPicker selected={value} users={users} onChange={onChange}>
      {({ onClick, ref }) => (
        <button
          ref={ref}
          onClick={onClick}
          type="button"
          className="task-panel-control"
          style={{
            ...panelControlStyle,
            display: "inline-flex", alignItems: "center", gap: 8,
          }}
        >
          {owner ? (
            <>
              <span style={{
                width: 22, height: 22, borderRadius: "50%",
                background: owner.color, color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>{userInitial(owner.label)}</span>
              <span style={{ fontSize: 14 }}>{owner.label}</span>
            </>
          ) : (
            <>
              <span style={{
                width: 22, height: 22, borderRadius: "50%",
                border: "1px dashed var(--color-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--color-text-tertiary)", flexShrink: 0,
                fontSize: 13,
              }}>+</span>
              <span style={{ fontSize: 14, color: "var(--color-text-tertiary)" }}>Unassigned</span>
            </>
          )}
        </button>
      )}
    </UserPicker>
  );
}

function PillSelect({
  value, options, onChange,
}: {
  value: string;
  options: { value: string; label: string; bg: string; color: string }[];
  onChange: (next: string) => void;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  const enumOptions = options.map((o) => ({
    value: o.value,
    label: o.label,
    color: o.bg === "transparent" ? undefined : o.color,
  }));
  return (
    <EnumPicker selected={value} options={enumOptions} onChange={onChange}>
      {({ onClick, ref }) => (
        <button
          ref={ref}
          onClick={onClick}
          type="button"
          className="task-panel-control"
          style={{
            ...panelControlStyle,
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 8px",
          }}
        >
          <span
            style={{
              display: "inline-flex", alignItems: "center",
              padding: "3px 10px", borderRadius: 999,
              fontSize: 12, fontWeight: 600,
              background: current.bg, color: current.color,
              border: current.bg === "transparent" ? "1px solid var(--color-border)" : "none",
            }}
          >
            {current.label}
          </span>
        </button>
      )}
    </EnumPicker>
  );
}

/* ── edit project modal ─────────────────────────────────────── */
function EditProjectModal({
  project, users, onClose, onSaved,
}: {
  project: Project;
  users: DirectoryUser[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [ownerEmail, setOwnerEmail] = useState(project.ownerEmail ?? "");
  const [startDate, setStartDate] = useState(project.startDate ?? "");
  const [endDate, setEndDate] = useState(project.endDate ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [type, setType] = useState<ProjectType>(project.type);
  const [department, setDepartment] = useState<Department | "">(project.department ?? "");
  const [collaborators, setCollaborators] = useState<string[]>(project.collaborators);
  const [accessMode, setAccessMode] = useState<"everyone" | "restricted">(project.accessMode);
  const [accessUsers, setAccessUsers] = useState<string[]>(project.accessUsers);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          ownerEmail: ownerEmail || null,
          startDate: startDate || null,
          endDate: type === "ongoing" ? null : (endDate || null),
          status,
          type,
          department: department || null,
          accessMode,
          setCollaborators: collaborators,
          setAccessUsers: accessMode === "restricted" ? accessUsers : [],
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || `HTTP ${res.status}`);
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete project "${project.name}" and all its tasks? This cannot be undone — use Archive if you might want it back.`)) return;
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) window.location.href = `/workspace/${project.companyId}`;
  }

  async function handleArchiveToggle() {
    const next: ProjectStatus = status === "archived" ? "active" : "archived";
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || `HTTP ${res.status}`);
      }
      setStatus(next);
      if (next === "archived") {
        window.location.href = `/workspace/${project.companyId}`;
      } else {
        onSaved();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit project" onClose={onClose} width={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} disabled={saving} />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
        <Field label="Type">
          <div style={{ display: "flex", gap: 8 }}>
            {([
              { v: "quarterly" as const, label: "Quarterly" },
              { v: "initiative" as const, label: "Big project" },
              { v: "ongoing" as const, label: "Ongoing" },
            ]).map((t) => (
              <button
                key={t.v}
                type="button"
                onClick={() => setType(t.v)}
                style={{
                  ...secondaryButtonStyle,
                  borderColor: type === t.v ? "var(--color-accent)" : "var(--color-border)",
                  color: type === t.v ? "#0071E3" : "var(--color-text-primary)",
                  background: type === t.v ? "rgba(0,113,227,0.08)" : "transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Department">
            <select value={department} onChange={(e) => setDepartment(e.target.value as Department | "")} style={inputStyle}>
              <option value="">None</option>
              <option value="ppc">PPC</option>
              <option value="seo">SEO</option>
              <option value="content">Content</option>
              <option value="web">Web</option>
            </select>
          </Field>
          <Field label="Primary owner">
            <select value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} style={inputStyle}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.email} value={u.email}>{u.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} style={inputStyle}>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="done">Done</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Field label="Start date">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </Field>
          {type !== "ongoing" && (
            <Field label="End date">
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
            </Field>
          )}
        </div>
        {type === "quarterly" && (
          <Field label="Quarter quick-pick">
            <select
              value=""
              onChange={(e) => {
                const q = upcomingQuarters(5).find((x) => x.key === e.target.value);
                if (q) {
                  setStartDate(q.startDate);
                  setEndDate(q.endDate);
                }
                e.currentTarget.value = "";
              }}
              style={inputStyle}
            >
              <option value="">Pick a quarter to fill dates…</option>
              {upcomingQuarters(5).map((q) => (
                <option key={q.key} value={q.key}>{q.label}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Collaborators">
          <MultiUserPicker selected={collaborators} users={users} onChange={setCollaborators} exclude={ownerEmail || null} />
        </Field>
        <Field label="Access">
          <div style={{ display: "flex", gap: 8 }}>
            {(["everyone", "restricted"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAccessMode(m)}
                style={{
                  ...secondaryButtonStyle,
                  borderColor: accessMode === m ? "var(--color-accent)" : "var(--color-border)",
                  color: accessMode === m ? "#0071E3" : "var(--color-text-primary)",
                  background: accessMode === m ? "rgba(0,113,227,0.08)" : "transparent",
                }}
              >
                {m === "everyone" ? "Everyone in company" : "Restricted"}
              </button>
            ))}
          </div>
        </Field>
        {accessMode === "restricted" && (
          <Field label="Who can see this project">
            <MultiUserPicker selected={accessUsers} users={users} onChange={setAccessUsers} />
          </Field>
        )}
        {err && <div style={{ fontSize: 12, color: "#B91C1C" }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={handleArchiveToggle} style={secondaryButtonStyle} disabled={saving}>
            {status === "archived" ? "Unarchive" : "Archive"}
          </button>
          <button onClick={handleDelete} style={{ ...secondaryButtonStyle, borderColor: "#FCA5A5", color: "#B91C1C" }} disabled={saving}>Delete</button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={secondaryButtonStyle} disabled={saving}>Cancel</button>
          <button onClick={submit} style={primaryButtonStyle} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── View switcher + alternative views ─── */

function ProjectViewSwitcher({ value, onChange }: { value: ProjectViewMode; onChange: (m: ProjectViewMode) => void }) {
  const Btn = ({ mode, label, children }: { mode: ProjectViewMode; label: string; children: React.ReactNode }) => (
    <button
      onClick={() => onChange(mode)}
      title={label}
      aria-label={label}
      style={{
        padding: 6,
        background: value === mode ? "rgba(0,113,227,0.1)" : "transparent",
        border: "none", borderRadius: 8,
        color: value === mode ? "var(--color-accent)" : "var(--color-text-secondary)",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >{children}</button>
  );
  return (
    <div style={{ display: "flex", gap: 2 }}>
      <Btn mode="list" label="List view">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" />
        </svg>
      </Btn>
      <Btn mode="kanban" label="Kanban view">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="10" rx="1" /><rect x="17" y="4" width="4" height="13" rx="1" />
        </svg>
      </Btn>
      <Btn mode="calendar" label="Calendar view">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" />
          <line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" />
        </svg>
      </Btn>
      <Btn mode="gantt" label="Gantt view">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="3" y2="20" />
          <rect x="6" y="6" width="9" height="3" rx="1" />
          <rect x="9" y="11" width="11" height="3" rx="1" />
          <rect x="6" y="16" width="7" height="3" rx="1" />
        </svg>
      </Btn>
    </div>
  );
}

function ProjectKanban({
  sections, tasksBySection, users, projectId, onOpenTask, onMutate,
}: {
  sections: Section[];
  tasksBySection: Record<string, Task[]>;
  users: DirectoryUser[];
  projectId: string;
  onOpenTask: (id: string) => void;
  onMutate: (url: string, init: RequestInit) => Promise<unknown>;
}) {
  // Show every section as a column, plus an "Unsectioned" column if it has tasks.
  const columns: { id: string; name: string; tasks: Task[]; isUnsectioned?: boolean }[] = [
    ...sections.map((s) => ({ id: s.id, name: s.name, tasks: tasksBySection[s.id] ?? [] })),
  ];
  if ((tasksBySection.unsectioned ?? []).length > 0) {
    columns.push({ id: "unsectioned", name: "Unsectioned", tasks: tasksBySection.unsectioned, isUnsectioned: true });
  }

  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
      {columns.map((c) => (
        <KanbanSectionColumn
          key={c.id}
          sectionId={c.isUnsectioned ? null : c.id}
          name={c.name}
          tasks={c.tasks}
          users={users}
          projectId={projectId}
          onOpenTask={onOpenTask}
          onMutate={onMutate}
        />
      ))}
    </div>
  );
}

function KanbanSectionColumn({
  sectionId, name, tasks, users, projectId, onOpenTask, onMutate,
}: {
  sectionId: string | null;
  name: string;
  tasks: Task[];
  users: DirectoryUser[];
  projectId: string;
  onOpenTask: (id: string) => void;
  onMutate: (url: string, init: RequestInit) => Promise<unknown>;
}) {
  const [dropActive, setDropActive] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  function onDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("application/x-task-id")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dropActive) setDropActive(true);
  }
  function onDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDropActive(false);
  }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropActive(false);
    const taskId = e.dataTransfer.getData("application/x-task-id");
    const fromSectionId = e.dataTransfer.getData("application/x-from-section");
    if (!taskId) return;
    if ((fromSectionId || null) === sectionId) return;
    await onMutate(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId }),
    });
  }
  async function commitAdd(opts?: { keepFocus?: boolean }) {
    const title = draft.trim();
    if (!title) { setAdding(false); setDraft(""); return; }
    await onMutate("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, sectionId, title }),
    });
    setDraft("");
    if (opts?.keepFocus) inputRef.current?.focus();
    else setAdding(false);
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        flex: "0 0 300px",
        background: "var(--bg-card)",
        borderRadius: 14,
        boxShadow: dropActive ? "0 0 0 2px var(--color-accent)" : "var(--shadow-card)",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        maxHeight: "calc(100vh - 280px)",
        transition: "box-shadow 100ms",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px",
        borderBottom: "1px solid var(--color-border)",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", background: "rgba(0,0,0,0.04)", padding: "2px 7px", borderRadius: 999 }}>
          {tasks.filter((t) => !t.completed).length}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.length === 0 && !adding && (
          <div style={{ padding: "10px 6px", fontSize: 12, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
            Empty.
          </div>
        )}
        {tasks.map((t) => (
          <ProjectKanbanCard key={t.id} task={t} users={users} onOpen={() => onOpenTask(t.id)} onMutate={onMutate} />
        ))}
        {adding ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid var(--color-accent)", borderRadius: 10, background: "rgba(0,113,227,0.04)" }}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Task name… (Enter or click off to save)"
              onBlur={() => commitAdd()}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitAdd({ keepFocus: true }); }
                if (e.key === "Escape") { setAdding(false); setDraft(""); }
              }}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, fontFamily: "inherit", color: "var(--color-text-primary)" }}
            />
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            style={{
              padding: "8px 10px", borderRadius: 10,
              background: "transparent", border: "1px dashed var(--color-border)",
              cursor: "pointer", fontFamily: "inherit",
              fontSize: 12, color: "var(--color-text-tertiary)", textAlign: "left",
            }}
          >
            + Add task
          </button>
        )}
      </div>
    </div>
  );
}

function ProjectKanbanCard({
  task, users, onOpen, onMutate,
}: {
  task: Task;
  users: DirectoryUser[];
  onOpen: () => void;
  onMutate: (url: string, init: RequestInit) => Promise<unknown>;
}) {
  const allTags = useTags();
  const owner = userMeta(task.ownerEmail, users);
  const dStat = dueState(task.endDate);
  const dueLabel = fmtDate(task.endDate);
  async function toggleComplete(e: React.MouseEvent) {
    e.stopPropagation();
    await onMutate(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
  }
  return (
    <div
      onClick={onOpen}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-task-id", task.id);
        e.dataTransfer.setData("application/x-from-section", task.sectionId ?? "");
        e.currentTarget.style.opacity = "0.5";
      }}
      onDragEnd={(e) => { e.currentTarget.style.opacity = "1"; }}
      style={{
        background: "white",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        padding: "10px 12px",
        cursor: "pointer",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        display: "flex", flexDirection: "column", gap: 8,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <button
          onClick={toggleComplete}
          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
          style={{
            width: 16, height: 16, borderRadius: "50%",
            border: `1.5px solid ${task.completed ? "#10B981" : "var(--color-text-tertiary)"}`,
            background: task.completed ? "#10B981" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0, flexShrink: 0, marginTop: 2,
          }}
        >
          {task.completed && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="5,12 10,17 19,7" /></svg>}
        </button>
        <div style={{
          flex: 1, minWidth: 0,
          fontSize: 13, fontWeight: 500, lineHeight: 1.35,
          color: task.completed ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
          textDecoration: task.completed ? "line-through" : "none",
          wordBreak: "break-word",
        }}>
          {task.title}
        </div>
      </div>
      {(task.priority || task.tagIds.length > 0 || task.endDate || owner) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {task.priority && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: PRIORITY_META[task.priority].color, background: PRIORITY_META[task.priority].bg,
              padding: "2px 7px", borderRadius: 999,
            }}>
              {PRIORITY_META[task.priority].label}
            </span>
          )}
          {task.tagIds.length > 0 && (
            <TagPillList tagIds={task.tagIds} allTags={allTags} max={2} size="xs" />
          )}
          {task.endDate && (
            <span style={{
              fontSize: 10, fontWeight: 500,
              padding: "2px 7px", borderRadius: 999,
              ...(dStat ? { color: DUE_STYLE[dStat].color, background: DUE_STYLE[dStat].bg } : { color: "var(--color-text-secondary)", background: "rgba(0,0,0,0.04)" }),
            }}>
              {dueLabel}
            </span>
          )}
          {owner && (
            <span style={{ marginLeft: "auto" }}>
              <Avatar user={owner} size={20} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const PROJECT_CAL_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PROJECT_CAL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function ProjectCalendar({
  tasks, users, onOpenTask,
}: {
  tasks: Task[];
  users: DirectoryUser[];
  onOpenTask: (id: string) => void;
}) {
  const [view, setView] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const monthLabel = `${PROJECT_CAL_MONTHS[view.getMonth()]} ${view.getFullYear()}`;
  const firstWeekday = ((view.getDay() + 6) % 7); // Mon-first
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();

  // Group tasks by ISO date string
  const tasksByDate = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.endDate) continue;
      const list = m.get(t.endDate) ?? [];
      list.push(t);
      m.set(t.endDate, list);
    }
    return m;
  }, [tasks]);

  const cells: { iso: string | null; day: number | null }[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ iso: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ iso, day: d });
  }
  while (cells.length % 7 !== 0) cells.push({ iso: null, day: null });

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 18, padding: 18, boxShadow: "var(--shadow-card)" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <button
          onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
          style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: "var(--color-text-secondary)" }}
        >‹</button>
        <h3 style={{ flex: 1, textAlign: "center", margin: 0, fontSize: 15, fontWeight: 600 }}>{monthLabel}</h3>
        <button
          onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
          style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: "var(--color-text-secondary)" }}
        >›</button>
        <button
          onClick={() => { const t = new Date(); setView(new Date(t.getFullYear(), t.getMonth(), 1)); }}
          style={{ marginLeft: 8, background: "transparent", border: "1px solid var(--color-border)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: "var(--color-text-secondary)" }}
        >Today</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: "var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
        {PROJECT_CAL_WEEKDAYS.map((w) => (
          <div key={w} style={{ background: "rgba(0,0,0,0.02)", padding: "8px 6px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)" }}>{w}</div>
        ))}
        {cells.map((c, i) => {
          const dayTasks = c.iso ? (tasksByDate.get(c.iso) ?? []) : [];
          const isToday = c.iso === todayIso;
          return (
            <div key={i} style={{
              background: c.day == null ? "rgba(0,0,0,0.015)" : "white",
              minHeight: 90, padding: 6,
              display: "flex", flexDirection: "column", gap: 4,
              outline: isToday ? "2px solid var(--color-accent)" : "none",
              outlineOffset: -2,
            }}>
              {c.day != null && (
                <div style={{ fontSize: 11, fontWeight: 500, color: isToday ? "var(--color-accent)" : "var(--color-text-secondary)" }}>{c.day}</div>
              )}
              {dayTasks.map((t) => {
                const owner = userMeta(t.ownerEmail, users);
                const ownerColor = owner?.color ?? "#94A3B8";
                return (
                  <button
                    key={t.id}
                    onClick={() => onOpenTask(t.id)}
                    title={t.title}
                    style={{
                      textAlign: "left",
                      background: `${ownerColor}1A`,
                      color: t.completed ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
                      textDecoration: t.completed ? "line-through" : "none",
                      border: `1px solid ${ownerColor}40`,
                      borderRadius: 6,
                      padding: "3px 6px", fontSize: 11, fontWeight: 500,
                      cursor: "pointer", fontFamily: "inherit",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}
                  >
                    {t.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PROJ_GANTT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ProjectGantt({
  tasks, sections, users, onOpenTask,
}: {
  tasks: Task[];
  sections: Section[];
  users: DirectoryUser[];
  onOpenTask: (id: string) => void;
}) {
  // Default span: 2 months centered on today (1 month back, 1 month forward).
  const [anchorMonth, setAnchorMonth] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth() - 1, 1);
  });
  const monthSpan = 3;
  const months: Date[] = [];
  for (let i = 0; i < monthSpan; i++) {
    months.push(new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + i, 1));
  }
  const rangeStart = months[0].getTime();
  const rangeEnd = new Date(months[monthSpan - 1].getFullYear(), months[monthSpan - 1].getMonth() + 1, 0, 23, 59).getTime();
  const totalMs = rangeEnd - rangeStart;

  function parseIso(iso: string | null): number | null {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d).getTime();
  }

  const sectionName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sections) m.set(s.id, s.name);
    return m;
  }, [sections]);

  const dated: { t: Task; startMs: number; endMs: number }[] = [];
  const undated: Task[] = [];
  for (const t of tasks) {
    const s = parseIso(t.startDate);
    const e = parseIso(t.endDate);
    if (s == null && e == null) { undated.push(t); continue; }
    const startMs = s ?? e!;
    const endMs = e ?? s!;
    if (endMs < rangeStart || startMs > rangeEnd) continue;
    dated.push({ t, startMs, endMs });
  }
  // Sort by section then start date
  dated.sort((a, b) => {
    const sa = a.t.sectionId ?? "";
    const sb = b.t.sectionId ?? "";
    if (sa !== sb) return sa.localeCompare(sb);
    return a.startMs - b.startMs;
  });

  const todayMs = Date.now();
  const todayPct = todayMs >= rangeStart && todayMs <= rangeEnd ? ((todayMs - rangeStart) / totalMs) * 100 : null;

  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 18, padding: 18, boxShadow: "var(--shadow-card)" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14, gap: 8 }}>
        <button
          onClick={() => setAnchorMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: "var(--color-text-secondary)" }}
        >‹</button>
        <h3 style={{ flex: 1, textAlign: "center", margin: 0, fontSize: 14, fontWeight: 600 }}>
          {PROJ_GANTT_MONTHS[months[0].getMonth()]} {months[0].getFullYear()} – {PROJ_GANTT_MONTHS[months[monthSpan - 1].getMonth()]} {months[monthSpan - 1].getFullYear()}
        </h3>
        <button
          onClick={() => setAnchorMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: "var(--color-text-secondary)" }}
        >›</button>
        <button
          onClick={() => { const t = new Date(); setAnchorMonth(new Date(t.getFullYear(), t.getMonth() - 1, 1)); }}
          style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: "var(--color-text-secondary)" }}
        >Today</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${monthSpan}, 1fr)`, marginLeft: 240, borderBottom: "1px solid var(--color-border)" }}>
        {months.map((m, i) => (
          <div key={i} style={{
            padding: "6px 8px", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)",
            borderLeft: "1px solid var(--color-border)", textAlign: "center",
          }}>
            {PROJ_GANTT_MONTHS[m.getMonth()]} {m.getFullYear()}
          </div>
        ))}
      </div>

      <div style={{ position: "relative" }}>
        {todayPct != null && (
          <div style={{
            position: "absolute",
            left: `calc(240px + ${todayPct}% * (100% - 240px) / 100)`,
            top: 0, bottom: 0, width: 1.5,
            background: "var(--color-accent)", zIndex: 1, pointerEvents: "none",
          }} />
        )}
        {dated.length === 0 ? (
          <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 12, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
            No scheduled tasks in this range.
          </div>
        ) : (
          dated.map(({ t, startMs, endMs }) => {
            const leftPct = Math.max(0, ((startMs - rangeStart) / totalMs) * 100);
            const widthPct = Math.max(1.5, ((Math.min(endMs, rangeEnd) - Math.max(startMs, rangeStart)) / totalMs) * 100);
            const owner = userMeta(t.ownerEmail, users);
            const ownerColor = owner?.color ?? "#94A3B8";
            const sectionLabel = t.sectionId ? sectionName.get(t.sectionId) ?? "" : "Unsectioned";
            return (
              <div key={t.id} style={{
                display: "grid", gridTemplateColumns: "240px 1fr", borderBottom: "1px solid var(--color-border)",
                alignItems: "center", minHeight: 32,
              }}>
                <button
                  onClick={() => onOpenTask(t.id)}
                  style={{
                    background: "transparent", border: "none", padding: "6px 10px", cursor: "pointer", fontFamily: "inherit",
                    textAlign: "left", display: "flex", alignItems: "center", gap: 6, minWidth: 0,
                  }}
                >
                  <span style={{
                    fontSize: 10, fontWeight: 500, color: "var(--color-text-tertiary)",
                    background: "rgba(0,0,0,0.04)", padding: "1px 6px", borderRadius: 999,
                    flexShrink: 0, maxWidth: 80, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {sectionLabel}
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 500,
                    color: t.completed ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
                    textDecoration: t.completed ? "line-through" : "none",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
                  }}>
                    {t.title}
                  </span>
                </button>
                <div style={{ position: "relative", height: 24 }}>
                  <button
                    onClick={() => onOpenTask(t.id)}
                    title={`${fmtDate(t.startDate)} → ${fmtDate(t.endDate)}`}
                    style={{
                      position: "absolute",
                      left: `${leftPct}%`, width: `${widthPct}%`,
                      top: 4, bottom: 4,
                      background: t.completed ? "rgba(0,0,0,0.15)" : `${ownerColor}DD`,
                      border: "none", borderRadius: 5,
                      cursor: "pointer", fontFamily: "inherit",
                      color: "white", fontSize: 10, fontWeight: 600,
                      padding: "0 6px", textAlign: "left",
                      display: "flex", alignItems: "center",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}
                  >
                    {widthPct > 6 ? t.title : ""}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {undated.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
            No scheduled dates
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {undated.map((t) => (
              <button
                key={t.id}
                onClick={() => onOpenTask(t.id)}
                style={{
                  background: "rgba(0,0,0,0.04)", border: "1px solid var(--color-border)",
                  borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 500,
                  color: "var(--color-text-secondary)", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Estimated time input + start-timer button ─── */

function EstTimeInput({
  valueHours, onChange, taskId, taskTitle,
}: {
  valueHours: number | null;
  onChange: (next: number | null) => void;
  taskId: string;
  taskTitle: string;
}) {
  const totalMinutes = valueHours == null ? null : Math.round(valueHours * 60);
  const hPart = totalMinutes == null ? "" : String(Math.floor(totalMinutes / 60));
  const mPart = totalMinutes == null ? "" : String(totalMinutes % 60);
  const { startTimer, active } = useTimer();
  const isActiveForThisTask = active?.taskId === taskId;

  function commit(nextH: string, nextM: string) {
    const h = nextH === "" ? 0 : Math.max(0, Number(nextH) || 0);
    const m = nextM === "" ? 0 : Math.max(0, Number(nextM) || 0);
    const minutes = h * 60 + m;
    if (minutes <= 0) {
      onChange(null);
      return;
    }
    onChange(minutes / 60);
  }

  const inputStyle: React.CSSProperties = {
    ...panelControlStyle,
    width: 56, textAlign: "right", padding: "6px 8px",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <input
        type="number" min={0} step={1}
        value={hPart}
        onChange={(e) => commit(e.target.value, mPart)}
        style={inputStyle}
        placeholder="0"
        aria-label="Hours"
      />
      <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>h</span>
      <input
        type="number" min={0} max={59} step={1}
        value={mPart}
        onChange={(e) => commit(hPart, e.target.value)}
        style={inputStyle}
        placeholder="0"
        aria-label="Minutes"
      />
      <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>m</span>
      {totalMinutes != null && totalMinutes > 0 && !isActiveForThisTask && (
        <button
          onClick={() => startTimer(taskId, taskTitle, totalMinutes * 60)}
          title="Start countdown timer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "6px 10px", borderRadius: 8,
            background: "var(--color-accent)", color: "white",
            border: "none", cursor: "pointer", fontFamily: "inherit",
            fontSize: 12, fontWeight: 600,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6,4 20,12 6,20" />
          </svg>
          Start
        </button>
      )}
      {isActiveForThisTask && (
        <span style={{ fontSize: 11, color: "var(--color-accent)", fontWeight: 600 }}>Timer running…</span>
      )}
    </div>
  );
}

/* ─── Filters dropdown ─── */

const TRACKER_OPTIONS = [
  { key: "overdue" as TrackerStatus, label: "Overdue" },
  { key: "behind" as TrackerStatus, label: "Behind" },
  { key: "on_track" as TrackerStatus, label: "On track" },
  { key: "ahead" as TrackerStatus, label: "Ahead" },
  { key: "upcoming" as TrackerStatus, label: "Upcoming" },
  { key: "unscheduled" as TrackerStatus, label: "Unscheduled" },
];

function TaskFiltersDropdown({
  users, filterAssignee, setFilterAssignee, showCompleted, setShowCompleted,
  trackerFilter, setTrackerFilter, rollup,
}: {
  users: DirectoryUser[];
  filterAssignee: string | "all";
  setFilterAssignee: (v: string | "all") => void;
  showCompleted: boolean;
  setShowCompleted: (v: boolean | ((p: boolean) => boolean)) => void;
  trackerFilter: TrackerStatus | "all";
  setTrackerFilter: (v: TrackerStatus | "all") => void;
  rollup: ReturnType<typeof rollupTaskStatuses> | null;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Active filter count (excludes defaults)
  const activeCount =
    (filterAssignee !== "all" ? 1 : 0) +
    (trackerFilter !== "all" ? 1 : 0) +
    (showCompleted ? 1 : 0);

  const assigneeLabel =
    filterAssignee === "all" ? "Everyone"
    : filterAssignee === "" ? "Unassigned"
    : userMeta(filterAssignee, users)?.label ?? filterAssignee;

  function clearAll() {
    setFilterAssignee("all");
    setTrackerFilter("all");
    setShowCompleted(true);
  }

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 999,
          background: open ? "rgba(0,113,227,0.08)" : "transparent",
          border: `1px solid ${open ? "var(--color-accent)" : "var(--color-border)"}`,
          color: open ? "var(--color-accent)" : "var(--color-text-secondary)",
          fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 5h18M6 12h12M10 19h4" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span style={{
            background: "var(--color-accent)", color: "white",
            fontSize: 10, fontWeight: 700,
            padding: "1px 6px", borderRadius: 999, minWidth: 16,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>{activeCount}</span>
        )}
      </button>

      {/* Active filter pills (only shown for non-default values) */}
      {filterAssignee !== "all" && (
        <ActivePill label={`Assignee: ${assigneeLabel}`} onClear={() => setFilterAssignee("all")} />
      )}
      {trackerFilter !== "all" && (
        <ActivePill label={`Status: ${TRACKER_OPTIONS.find((o) => o.key === trackerFilter)?.label ?? trackerFilter}`} onClear={() => setTrackerFilter("all")} />
      )}
      {showCompleted && (
        <ActivePill label="Showing completed" onClear={() => setShowCompleted(false)} />
      )}

      {open && (
        <div
          ref={popoverRef}
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30,
            width: 280,
            background: "white",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            boxShadow: "0 10px 32px rgba(0,0,0,0.15)",
            padding: 14,
            display: "flex", flexDirection: "column", gap: 14,
            maxHeight: "min(70vh, 480px)", overflowY: "auto",
          }}
        >
          <FilterSection label="Assignee">
            <FilterRadio active={filterAssignee === "all"} onClick={() => setFilterAssignee("all")} label="Everyone" />
            <FilterRadio active={filterAssignee === ""} onClick={() => setFilterAssignee("")} label="Unassigned" />
            {users.map((u) => (
              <FilterRadio
                key={u.email}
                active={filterAssignee === u.email}
                onClick={() => setFilterAssignee(u.email)}
                label={u.label}
                colorDot={u.color}
              />
            ))}
          </FilterSection>

          {rollup && rollup.total > 0 && (
            <FilterSection label="Status">
              <FilterRadio active={trackerFilter === "all"} onClick={() => setTrackerFilter("all")} label={`All (${rollup.total})`} />
              {TRACKER_OPTIONS.map((o) => {
                const count = rollup[o.key];
                if (count === 0) return null;
                return (
                  <FilterRadio
                    key={o.key}
                    active={trackerFilter === o.key}
                    onClick={() => setTrackerFilter(o.key)}
                    label={`${o.label} (${count})`}
                    colorDot={TRACKER_STYLE[o.key].dot}
                  />
                );
              })}
            </FilterSection>
          )}

          <FilterSection label="Display">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-text-primary)", cursor: "pointer", padding: "4px 0" }}>
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                style={{ margin: 0 }}
              />
              Show completed
            </label>
          </FilterSection>

          {activeCount > 0 && (
            <button
              onClick={clearAll}
              style={{
                background: "transparent", border: "1px solid var(--color-border)",
                borderRadius: 8, padding: "6px 10px",
                fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Reset all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {children}
      </div>
    </div>
  );
}

function FilterRadio({ active, onClick, label, colorDot }: { active: boolean; onClick: () => void; label: string; colorDot?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 8px", borderRadius: 6,
        background: active ? "rgba(0,113,227,0.08)" : "transparent",
        border: "none", cursor: "pointer", fontFamily: "inherit",
        fontSize: 13, color: active ? "var(--color-accent)" : "var(--color-text-primary)",
        fontWeight: active ? 600 : 400,
        textAlign: "left", width: "100%",
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget.style.background = "rgba(0,0,0,0.04)"); }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget.style.background = "transparent"); }}
    >
      {colorDot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorDot, flexShrink: 0 }} />}
      <span style={{ flex: 1 }}>{label}</span>
      {active && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="5,12 10,17 19,7" />
        </svg>
      )}
    </button>
  );
}

function ActivePill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 6px 4px 10px", borderRadius: 999,
      background: "rgba(0,113,227,0.08)",
      color: "var(--color-accent)",
      fontSize: 11, fontWeight: 500,
    }}>
      {label}
      <button
        onClick={onClear}
        aria-label={`Clear ${label}`}
        style={{
          background: "transparent", border: "none", padding: 2,
          cursor: "pointer", color: "inherit", display: "flex",
          borderRadius: "50%",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6, fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
