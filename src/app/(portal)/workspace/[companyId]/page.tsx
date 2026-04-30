"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Avatar,
  AvatarStack,
  DirectoryUser,
  Modal,
  MultiUserPicker,
  PRIORITY_META,
  PROJECT_STATUS_META,
  colorForEmail,
  fmtDate,
  inputStyle,
  primaryButtonStyle,
  quarterFromDate,
  secondaryButtonStyle,
  upcomingQuarters,
  useUsers,
  userMeta,
} from "../_shared";
import { useRouter } from "next/navigation";
import { TRACKER_STYLE, computeTracker } from "@/lib/tracker";

type ProjectStatus = "planning" | "active" | "on_hold" | "done" | "archived";
type ProjectType = "quarterly" | "initiative" | "ongoing";
type Department = "ppc" | "seo" | "content" | "web";

const DEPARTMENT_META: Record<Department, { label: string; bg: string; color: string }> = {
  ppc: { label: "PPC", bg: "#FEF3C7", color: "#92400E" },
  seo: { label: "SEO", bg: "#DBEAFE", color: "#1E40AF" },
  content: { label: "Content", bg: "#FCE7F3", color: "#9D174D" },
  web: { label: "Web", bg: "#E0E7FF", color: "#3730A3" },
};


interface ProjectRow {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  ownerEmail: string | null;
  startDate: string | null;
  endDate: string | null;
  status: ProjectStatus;
  type: ProjectType;
  department: Department | null;
  accessMode: "everyone" | "restricted";
  createdAt: string;
  createdByEmail: string;
  collaborators: string[];
  taskCounts: { open: number; done: number };
}

interface CompanyDetail {
  id: string;
  name: string;
  description: string | null;
  accessMode: "everyone" | "restricted";
  createdByEmail: string;
  accessUsers: string[];
  projectCount: number;
}

interface CompanyTask {
  id: string;
  title: string;
  ownerEmail: string | null;
  startDate: string | null;
  endDate: string | null;
  priority: "low" | "medium" | "high" | null;
  status: "todo" | "doing" | "blocked" | "done";
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  parentTaskId: string | null;
  projectId: string;
  projectName: string;
}

export default function CompanyPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const users = useUsers();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [tasks, setTasks] = useState<CompanyTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [cRes, pRes, tRes] = await Promise.all([
        fetch(`/api/companies/${companyId}`, { cache: "no-store" }),
        fetch(`/api/projects?companyId=${companyId}`, { cache: "no-store" }),
        fetch(`/api/companies/${companyId}/tasks`, { cache: "no-store" }),
      ]);
      if (!cRes.ok) throw new Error(`HTTP ${cRes.status}`);
      if (!pRes.ok) throw new Error(`HTTP ${pRes.status}`);
      const cJson = (await cRes.json()) as CompanyDetail;
      const pJson = (await pRes.json()) as { projects: ProjectRow[] };
      const tJson = tRes.ok ? ((await tRes.json()) as { tasks: CompanyTask[] }) : { tasks: [] };
      setCompany(cJson);
      setProjects(pJson.projects);
      setTasks(tJson.tasks);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [companyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function deleteCompany() {
    if (!company) return;
    if (!confirm(`Delete company "${company.name}" and all its projects/tasks? This cannot be undone.`)) return;
    const res = await fetch(`/api/companies/${companyId}`, { method: "DELETE" });
    if (res.ok) window.location.href = "/workspace";
  }

  return (
    <div style={{ padding: "32px 36px 64px", maxWidth: 1100, margin: "0 auto" }}>
      <nav style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>
        <Link href="/workspace" style={{ color: "inherit", textDecoration: "none" }}>Workspace</Link>
        {" / "}
        {company ? company.name : "…"}
      </nav>

      {error && (
        <div style={{ padding: 16, background: "#FEE2E2", color: "#991B1B", borderRadius: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {company && (
        <div style={{
          background: "var(--bg-card)", borderRadius: 18, padding: "20px 22px",
          boxShadow: "var(--shadow-card)", marginBottom: 24,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "linear-gradient(135deg,#0071E3,#9333EA)",
              color: "white", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700, flexShrink: 0,
            }}>
              {company.name.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{company.name}</h1>
                <span style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 999,
                  background: company.accessMode === "everyone" ? "#D1FAE5" : "#FEE2E2",
                  color: company.accessMode === "everyone" ? "#065F46" : "#991B1B",
                  fontWeight: 600,
                }}>
                  {company.accessMode === "everyone" ? "Everyone" : `${company.accessUsers.length} member${company.accessUsers.length === 1 ? "" : "s"}`}
                </span>
              </div>
              {company.description && (
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>{company.description}</p>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditingCompany(true)} style={secondaryButtonStyle}>Edit</button>
              <button onClick={deleteCompany} style={{ ...secondaryButtonStyle, borderColor: "#FCA5A5", color: "#B91C1C" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <CompanyTasks tasks={tasks} projects={projects ?? []} users={users} companyId={companyId} />
      )}

      <div style={{ display: "flex", alignItems: "center", marginBottom: 14, marginTop: tasks.length > 0 ? 28 : 0 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Projects</h2>
        <button onClick={() => setCreating(true)} style={{ ...primaryButtonStyle, marginLeft: "auto" }}>
          + New project
        </button>
      </div>

      {projects && projects.length === 0 && (
        <div style={{ padding: "36px 20px", textAlign: "center", background: "var(--bg-card)", borderRadius: 18, boxShadow: "var(--shadow-card)" }}>
          <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>No projects in this company yet.</div>
        </div>
      )}

      {projects && projects.length > 0 && (
        <GroupedProjects projects={projects} users={users} />
      )}

      {creating && company && (
        <NewProjectModal
          companyId={companyId}
          users={users}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); refresh(); }}
        />
      )}

      {editingCompany && company && (
        <EditCompanyModal
          company={company}
          users={users}
          onClose={() => setEditingCompany(false)}
          onSaved={() => { setEditingCompany(false); refresh(); }}
        />
      )}
    </div>
  );
}

type CompanyTaskSort = "deadline" | "priority" | "recent";

function CompanyTasks({
  tasks, projects, users, companyId,
}: {
  tasks: CompanyTask[];
  projects: ProjectRow[];
  users: DirectoryUser[];
  companyId: string;
}) {
  const [sort, setSort] = useState<CompanyTaskSort>("deadline");
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [filterProject, setFilterProject] = useState<string>("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Unique assignees actually present in this company's tasks
  const assigneeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) if (t.ownerEmail) set.add(t.ownerEmail);
    return [...set];
  }, [tasks]);

  const filteredSorted = useMemo(() => {
    let list = tasks.filter((t) => !t.parentTaskId);
    if (!showCompleted) list = list.filter((t) => !t.completed);
    if (filterAssignee === "__none") list = list.filter((t) => !t.ownerEmail);
    else if (filterAssignee) list = list.filter((t) => t.ownerEmail === filterAssignee);
    if (filterProject) list = list.filter((t) => t.projectId === filterProject);

    const byDeadline = (a: CompanyTask, b: CompanyTask) => {
      const da = a.endDate ? new Date(a.endDate).getTime() : Number.POSITIVE_INFINITY;
      const db = b.endDate ? new Date(b.endDate).getTime() : Number.POSITIVE_INFINITY;
      return da - db;
    };
    const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const byPriority = (a: CompanyTask, b: CompanyTask) => {
      const ra = a.priority ? priorityRank[a.priority] : 3;
      const rb = b.priority ? priorityRank[b.priority] : 3;
      if (ra !== rb) return ra - rb;
      return byDeadline(a, b);
    };
    const byRecent = (a: CompanyTask, b: CompanyTask) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    const sorter = sort === "priority" ? byPriority : sort === "recent" ? byRecent : byDeadline;
    return [...list].sort(sorter);
  }, [tasks, sort, filterAssignee, filterProject, showCompleted]);

  const visible = showAll ? filteredSorted : filteredSorted.slice(0, 8);

  return (
    <section style={{
      background: "var(--bg-card)", borderRadius: 18,
      padding: "16px 20px",
      boxShadow: "var(--shadow-card)",
      marginBottom: 22,
    }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Tasks</h2>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", background: "rgba(0,0,0,0.04)", padding: "2px 8px", borderRadius: 999 }}>
          {filteredSorted.length}
        </span>
        <div style={{ flex: 1 }} />
        <FilterSelect value={sort} onChange={(v) => setSort(v as CompanyTaskSort)} ariaLabel="Sort">
          <option value="deadline">Sort: Deadline</option>
          <option value="priority">Sort: Priority</option>
          <option value="recent">Sort: Recently added</option>
        </FilterSelect>
        <FilterSelect value={filterAssignee} onChange={setFilterAssignee} ariaLabel="Assignee filter">
          <option value="">All assignees</option>
          <option value="__none">Unassigned</option>
          {assigneeOptions.map((email) => {
            const u = userMeta(email, users);
            return <option key={email} value={email}>{u?.label ?? email}</option>;
          })}
        </FilterSelect>
        <FilterSelect value={filterProject} onChange={setFilterProject} ariaLabel="Project filter">
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </FilterSelect>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-text-secondary)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            style={{ margin: 0 }}
          />
          Show done
        </label>
      </div>

      {visible.length === 0 ? (
        <div style={{ padding: "16px 4px", fontSize: 13, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
          No tasks match this view.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {visible.map((t) => (
            <CompanyTaskRow key={t.id} task={t} users={users} companyId={companyId} />
          ))}
        </div>
      )}

      {filteredSorted.length > 8 && (
        <div style={{ marginTop: 10, textAlign: "center" }}>
          <button
            onClick={() => setShowAll((v) => !v)}
            style={{
              background: "transparent", border: "none",
              color: "var(--color-accent)", fontSize: 12, fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {showAll ? "Show top 8" : `Show all ${filteredSorted.length}`}
          </button>
        </div>
      )}
    </section>
  );
}

function FilterSelect({
  value, onChange, ariaLabel, children,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      style={{
        padding: "5px 9px",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        fontSize: 12, fontFamily: "inherit",
        background: "var(--bg-card)",
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        outline: "none",
      }}
    >
      {children}
    </select>
  );
}

function CompanyTaskRow({ task, users, companyId }: { task: CompanyTask; users: DirectoryUser[]; companyId: string }) {
  const router = useRouter();
  const owner = userMeta(task.ownerEmail, users);
  const projectColor = colorForEmail(task.projectId);
  const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const dueMs = task.endDate ? new Date(task.endDate).getTime() : null;
  const overdue = dueMs != null && dueMs < todayMs && !task.completed;

  return (
    <div
      onClick={() => router.push(`/workspace/${companyId}/${task.projectId}?task=${task.id}`)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 4px", borderTop: "1px solid var(--color-border)",
        cursor: "pointer", transition: "background 100ms var(--ease-apple)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{
        width: 16, height: 16, borderRadius: "50%",
        border: `1.5px solid ${task.completed ? "#10B981" : "var(--color-text-tertiary)"}`,
        background: task.completed ? "#10B981" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {task.completed && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="5,12 10,17 19,7" /></svg>}
      </span>
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
        title={task.projectName}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 11, fontWeight: 500,
          padding: "3px 9px", borderRadius: 999,
          background: `${projectColor}1A`, color: projectColor,
          flexShrink: 0, maxWidth: 200,
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

function GroupedProjects({ projects, users }: { projects: ProjectRow[]; users: DirectoryUser[] }) {
  const quarterly = projects.filter((p) => p.type === "quarterly");
  const initiatives = projects.filter((p) => p.type === "initiative");
  const ongoing = projects.filter((p) => p.type === "ongoing");

  const quarterGroups = new Map<string, { label: string; sortKey: string; items: ProjectRow[] }>();
  const undatedQuarterly: ProjectRow[] = [];
  for (const p of quarterly) {
    const q = quarterFromDate(p.startDate);
    if (!q) {
      undatedQuarterly.push(p);
      continue;
    }
    const g = quarterGroups.get(q.key) ?? { label: q.label, sortKey: q.key, items: [] };
    g.items.push(p);
    quarterGroups.set(q.key, g);
  }
  const sortedQuarters = [...quarterGroups.values()].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {(quarterly.length > 0) && (
        <Section title="Quarterly">
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {sortedQuarters.map((g) => (
              <div key={g.sortKey}>
                <SubHeader>{g.label}</SubHeader>
                <ProjectList projects={g.items} users={users} />
              </div>
            ))}
            {undatedQuarterly.length > 0 && (
              <div>
                <SubHeader>No quarter set</SubHeader>
                <ProjectList projects={undatedQuarterly} users={users} />
              </div>
            )}
          </div>
        </Section>
      )}

      {initiatives.length > 0 && (
        <Section title="Big projects">
          <ProjectList projects={initiatives} users={users} />
        </Section>
      )}

      {ongoing.length > 0 && (
        <Section title="Ongoing">
          <ProjectList projects={ongoing} users={users} />
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--color-text-secondary)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 8px 2px" }}>
      {children}
    </div>
  );
}

function ProjectList({ projects, users }: { projects: ProjectRow[]; users: DirectoryUser[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} users={users} />
      ))}
    </div>
  );
}

function ProjectCard({ project, users }: { project: ProjectRow; users: DirectoryUser[] }) {
  const owner = userMeta(project.ownerEmail, users);
  const status = PROJECT_STATUS_META[project.status];
  const total = project.taskCounts.open + project.taskCounts.done;
  const pct = total === 0 ? 0 : Math.round((project.taskCounts.done / total) * 100);
  const tracker = computeTracker({
    startDate: project.startDate,
    endDate: project.endDate,
    completed: project.status === "done" || (total > 0 && project.taskCounts.done === total),
    progressOverride: total === 0 ? 0 : project.taskCounts.done / total,
  });
  const showTracker = tracker.status === "behind" || tracker.status === "overdue" || tracker.status === "ahead";
  const trackerStyle = TRACKER_STYLE[tracker.status];

  return (
    <Link
      href={`/workspace/${project.companyId}/${project.id}`}
      style={{
        display: "block",
        padding: "16px 18px",
        background: "var(--bg-card)",
        borderRadius: 14,
        boxShadow: "var(--shadow-card)",
        textDecoration: "none",
        color: "inherit",
        transition: "box-shadow 150ms var(--ease-apple)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-card-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-card)")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{project.name}</span>
            {project.department && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                padding: "2px 8px", borderRadius: 999,
                color: DEPARTMENT_META[project.department].color,
                background: DEPARTMENT_META[project.department].bg,
              }}>{DEPARTMENT_META[project.department].label}</span>
            )}
            <span style={{
              fontSize: 11, fontWeight: 600,
              padding: "2px 8px", borderRadius: 999,
              color: status.color, background: status.bg,
            }}>{status.label}</span>
            {showTracker && (
              <span
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 11, fontWeight: 600,
                  padding: "2px 8px", borderRadius: 999,
                  color: trackerStyle.color, background: trackerStyle.bg,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: trackerStyle.dot }} />
                {tracker.label}
              </span>
            )}
            {project.accessMode === "restricted" && (
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#FEE2E2", color: "#991B1B", fontWeight: 600 }}>
                Restricted
              </span>
            )}
          </div>
          {project.description && (
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {project.description}
            </p>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          {(project.startDate || project.endDate) && (
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {fmtDate(project.startDate) ?? "—"} → {fmtDate(project.endDate) ?? "—"}
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Avatar user={owner} size={26} />
            {project.collaborators.length > 0 && (
              <AvatarStack emails={project.collaborators} users={users} size={20} max={3} />
            )}
          </div>
          <div style={{ minWidth: 110, textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>
              {project.taskCounts.done}/{total} done
            </div>
            <div style={{ width: 110, height: 5, background: "rgba(0,0,0,0.06)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-accent)", transition: "width 200ms var(--ease-apple)" }} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function NewProjectModal({
  companyId, users, onClose, onCreated,
}: {
  companyId: string;
  users: DirectoryUser[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ProjectType>("quarterly");
  const [department, setDepartment] = useState<Department | "">("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          name: name.trim(),
          description: description.trim(),
          type,
          department: department || null,
          ownerEmail: ownerEmail || null,
          startDate: startDate || null,
          endDate: type === "ongoing" ? null : (endDate || null),
          collaborators,
        }),
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
    <Modal title="New project" onClose={onClose} width={520}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Name">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 Marketing Push" style={inputStyle} disabled={saving} />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} disabled={saving} />
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
        </div>

        {type === "quarterly" && (
          <Field label="Quarter">
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

        <div style={{ display: "grid", gridTemplateColumns: type === "ongoing" ? "1fr" : "1fr 1fr", gap: 12 }}>
          <Field label="Start date">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </Field>
          {type !== "ongoing" && (
            <Field label="End date">
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
            </Field>
          )}
        </div>

        <Field label="Collaborators">
          <MultiUserPicker selected={collaborators} users={users} onChange={setCollaborators} exclude={ownerEmail || null} />
        </Field>

        {err && <div style={{ fontSize: 12, color: "#B91C1C" }}>{err}</div>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={secondaryButtonStyle} disabled={saving}>Cancel</button>
          <button onClick={submit} style={primaryButtonStyle} disabled={saving || !name.trim()}>
            {saving ? "Creating…" : "Create project"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditCompanyModal({
  company, users, onClose, onSaved,
}: {
  company: CompanyDetail;
  users: DirectoryUser[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(company.name);
  const [description, setDescription] = useState(company.description ?? "");
  const [accessMode, setAccessMode] = useState<"everyone" | "restricted">(company.accessMode);
  const [members, setMembers] = useState<string[]>(company.accessUsers);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          accessMode,
          setUsers: accessMode === "restricted" ? members : [],
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

  return (
    <Modal title="Edit company" onClose={onClose} width={520}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} disabled={saving} />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} disabled={saving} />
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
                {m === "everyone" ? "Everyone" : "Restricted"}
              </button>
            ))}
          </div>
        </Field>
        {accessMode === "restricted" && (
          <Field label="Who can see this company">
            <MultiUserPicker selected={members} users={users} onChange={setMembers} />
          </Field>
        )}
        {err && <div style={{ fontSize: 12, color: "#B91C1C" }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={secondaryButtonStyle} disabled={saving}>Cancel</button>
          <button onClick={submit} style={primaryButtonStyle} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
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
