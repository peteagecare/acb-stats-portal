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
import { TagPillList, useTags } from "../_tags";
import { useFavourites } from "@/app/components/use-favourites";

type ProjectStatus = "planning" | "active" | "on_hold" | "done" | "archived";
type ProjectType = "quarterly" | "initiative" | "ongoing";
type Department = "ppc" | "seo" | "content" | "web";
type CompanyViewMode = "list" | "kanban" | "gantt";
const COMPANY_VIEW_KEY = "company-projects-view";

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
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  parentTaskId: string | null;
  projectId: string;
  projectName: string;
  tagIds: string[];
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
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<CompanyViewMode>("list");
  const { favourites } = useFavourites();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(COMPANY_VIEW_KEY);
    if (stored === "list" || stored === "kanban" || stored === "gantt") setViewMode(stored);
  }, []);

  function changeViewMode(next: CompanyViewMode) {
    setViewMode(next);
    if (typeof window !== "undefined") localStorage.setItem(COMPANY_VIEW_KEY, next);
  }

  async function changeProjectStatus(projectId: string, status: ProjectStatus) {
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refresh();
  }

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
    <div className="wsp-page" style={{ padding: "28px 32px 56px" }}>
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

      <div style={{ display: "flex", alignItems: "center", marginBottom: 14, marginTop: tasks.length > 0 ? 28 : 0, gap: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Projects</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <CompanyViewSwitcher value={viewMode} onChange={changeViewMode} />
          <button onClick={() => setCreating(true)} style={primaryButtonStyle}>
            + New project
          </button>
        </div>
      </div>

      {projects && projects.length === 0 && (
        <div style={{ padding: "36px 20px", textAlign: "center", background: "var(--bg-card)", borderRadius: 18, boxShadow: "var(--shadow-card)" }}>
          <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>No projects in this company yet.</div>
        </div>
      )}

      {projects && projects.length > 0 && (() => {
        const active = projects.filter((p) => p.status !== "archived");
        const archived = projects.filter((p) => p.status === "archived");
        const pinned = active.filter((p) => favourites.has(p.id));
        const unpinned = active.filter((p) => !favourites.has(p.id));
        return (
          <>
            {viewMode === "list" && (
              <>
                {pinned.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{
                      display: "flex", alignItems: "center", gap: 8,
                      fontSize: 13, fontWeight: 600, margin: "0 0 10px",
                      textTransform: "uppercase", letterSpacing: 0.5,
                      color: "var(--color-text-secondary)",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#EF4444" stroke="#EF4444" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                      Pinned
                    </h3>
                    <ProjectList projects={pinned} users={users} />
                  </div>
                )}
                {unpinned.length > 0 ? (
                  <GroupedProjects projects={unpinned} users={users} />
                ) : pinned.length === 0 ? (
                  <div style={{ padding: "36px 20px", textAlign: "center", background: "var(--bg-card)", borderRadius: 18, boxShadow: "var(--shadow-card)" }}>
                    <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>No active projects.</div>
                  </div>
                ) : null}
                {archived.length > 0 && (
                  <div style={{ marginTop: 28 }}>
                    <button
                      onClick={() => setShowArchived((v) => !v)}
                      style={{
                        background: "transparent", border: "none", padding: "6px 0",
                        fontSize: 13, color: "var(--color-text-secondary)", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <span style={{ display: "inline-block", transform: showArchived ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</span>
                      {showArchived ? "Hide" : "Show"} archived ({archived.length})
                    </button>
                    {showArchived && (
                      <div style={{ marginTop: 12, opacity: 0.75 }}>
                        <GroupedProjects projects={archived} users={users} />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {viewMode === "kanban" && (
              <ProjectsKanban projects={active} companyId={companyId} users={users} onChangeStatus={changeProjectStatus} />
            )}
            {viewMode === "gantt" && (
              <ProjectsGantt projects={active} companyId={companyId} users={users} />
            )}
          </>
        );
      })()}

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
          {projects.filter((p) => p.status !== "archived").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
  const allTags = useTags();
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
  // Sort: current quarter first, then future ascending, then past quarters
  // (most recent past first)
  const now = new Date();
  const currentKey = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  const sortedQuarters = [...quarterGroups.values()].sort((a, b) => {
    const aFuture = a.sortKey >= currentKey;
    const bFuture = b.sortKey >= currentKey;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    return aFuture
      ? a.sortKey.localeCompare(b.sortKey)
      : b.sortKey.localeCompare(a.sortKey);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {ongoing.length > 0 && (
        <Section title="Ongoing">
          <ProjectList projects={ongoing} users={users} />
        </Section>
      )}

      {initiatives.length > 0 && (
        <Section title="Big projects">
          <ProjectList projects={initiatives} users={users} />
        </Section>
      )}

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

/* ─── View switcher + alternative project views ─── */

function CompanyViewSwitcher({ value, onChange }: { value: CompanyViewMode; onChange: (m: CompanyViewMode) => void }) {
  const Btn = ({ mode, label, children }: { mode: CompanyViewMode; label: string; children: React.ReactNode }) => (
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

const PROJECT_KANBAN_COLUMNS: { status: ProjectStatus; label: string; accent: string }[] = [
  { status: "planning", label: "Planning", accent: "#94A3B8" },
  { status: "active", label: "Active", accent: "#0071E3" },
  { status: "on_hold", label: "On hold", accent: "#A855F7" },
  { status: "done", label: "Done", accent: "#10B981" },
];

function ProjectsKanban({
  projects, companyId, users, onChangeStatus,
}: {
  projects: ProjectRow[];
  companyId: string;
  users: DirectoryUser[];
  onChangeStatus: (projectId: string, status: ProjectStatus) => Promise<void>;
}) {
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
      {PROJECT_KANBAN_COLUMNS.map((col) => (
        <ProjectsKanbanColumn
          key={col.status}
          status={col.status}
          label={col.label}
          accent={col.accent}
          projects={projects.filter((p) => p.status === col.status)}
          companyId={companyId}
          users={users}
          onChangeStatus={onChangeStatus}
        />
      ))}
    </div>
  );
}

function ProjectsKanbanColumn({
  status, label, accent, projects, companyId, users, onChangeStatus,
}: {
  status: ProjectStatus;
  label: string;
  accent: string;
  projects: ProjectRow[];
  companyId: string;
  users: DirectoryUser[];
  onChangeStatus: (projectId: string, status: ProjectStatus) => Promise<void>;
}) {
  const [dropActive, setDropActive] = useState(false);

  function onDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("application/x-project-id")) return;
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
    const projectId = e.dataTransfer.getData("application/x-project-id");
    const fromStatus = e.dataTransfer.getData("application/x-from-status");
    if (!projectId || fromStatus === status) return;
    await onChangeStatus(projectId, status);
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
        boxShadow: dropActive ? `0 0 0 2px ${accent}` : "var(--shadow-card)",
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
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", background: "rgba(0,0,0,0.04)", padding: "2px 7px", borderRadius: 999 }}>
          {projects.length}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        {projects.length === 0 && (
          <div style={{ padding: "10px 6px", fontSize: 12, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
            None.
          </div>
        )}
        {projects.map((p) => (
          <ProjectKanbanCard key={p.id} project={p} companyId={companyId} users={users} />
        ))}
      </div>
    </div>
  );
}

function ProjectKanbanCard({
  project, companyId, users,
}: {
  project: ProjectRow;
  companyId: string;
  users: DirectoryUser[];
}) {
  const router = useRouter();
  const owner = userMeta(project.ownerEmail, users);
  const projectColor = colorForEmail(project.id);
  const total = project.taskCounts.open + project.taskCounts.done;
  const pct = total === 0 ? 0 : Math.round((project.taskCounts.done / total) * 100);

  return (
    <div
      onClick={() => router.push(`/workspace/${companyId}/${project.id}`)}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-project-id", project.id);
        e.dataTransfer.setData("application/x-from-status", project.status);
        e.currentTarget.style.opacity = "0.5";
      }}
      onDragEnd={(e) => { e.currentTarget.style.opacity = "1"; }}
      style={{
        background: "white",
        border: "1px solid var(--color-border)",
        borderLeft: `3px solid ${projectColor}`,
        borderRadius: 10,
        padding: "10px 12px",
        cursor: "pointer",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        display: "flex", flexDirection: "column", gap: 8,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.35, wordBreak: "break-word" }}>
        {project.name}
      </div>
      {project.description && (
        <div style={{
          fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.4,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {project.description}
        </div>
      )}
      {total > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 4, background: "rgba(0,0,0,0.06)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: projectColor }} />
          </div>
          <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", fontWeight: 500 }}>
            {project.taskCounts.done}/{total}
          </span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {project.department && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: DEPARTMENT_META[project.department].color,
            background: DEPARTMENT_META[project.department].bg,
            padding: "2px 7px", borderRadius: 999,
          }}>
            {DEPARTMENT_META[project.department].label}
          </span>
        )}
        {project.endDate && (
          <span style={{
            fontSize: 10, color: "var(--color-text-secondary)",
            background: "rgba(0,0,0,0.04)", padding: "2px 7px", borderRadius: 999,
          }}>
            {fmtDate(project.endDate)}
          </span>
        )}
        {owner && (
          <span style={{ marginLeft: "auto" }}>
            <Avatar user={owner} size={20} />
          </span>
        )}
      </div>
    </div>
  );
}

const PROJ_CAL_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ProjectsGantt({
  projects, companyId, users,
}: {
  projects: ProjectRow[];
  companyId: string;
  users: DirectoryUser[];
}) {
  const router = useRouter();
  // Show 6 months centered on the current month, projects rendered as horizontal bars
  // spanning their startDate → endDate. Projects without dates appear in a "No dates" footer list.
  const [anchorMonth, setAnchorMonth] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const monthSpan = 6;
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
  const dated: { p: ProjectRow; startMs: number; endMs: number }[] = [];
  const undated: ProjectRow[] = [];
  for (const p of projects) {
    const s = parseIso(p.startDate);
    const e = parseIso(p.endDate);
    if (s == null && e == null) { undated.push(p); continue; }
    const startMs = s ?? e!;
    const endMs = e ?? s!;
    if (endMs < rangeStart || startMs > rangeEnd) continue; // out of range
    dated.push({ p, startMs, endMs });
  }
  dated.sort((a, b) => a.startMs - b.startMs);

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
          {PROJ_CAL_MONTHS[months[0].getMonth()]} {months[0].getFullYear()} – {PROJ_CAL_MONTHS[months[monthSpan - 1].getMonth()]} {months[monthSpan - 1].getFullYear()}
        </h3>
        <button
          onClick={() => setAnchorMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: "var(--color-text-secondary)" }}
        >›</button>
        <button
          onClick={() => { const t = new Date(); setAnchorMonth(new Date(t.getFullYear(), t.getMonth(), 1)); }}
          style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: "var(--color-text-secondary)" }}
        >Today</button>
      </div>

      {/* Month header */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${monthSpan}, 1fr)`, marginLeft: 200, gap: 0, borderBottom: "1px solid var(--color-border)" }}>
        {months.map((m, i) => (
          <div key={i} style={{
            padding: "6px 8px", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)",
            borderLeft: i === 0 ? "1px solid var(--color-border)" : "1px solid var(--color-border)",
            textAlign: "center",
          }}>
            {PROJ_CAL_MONTHS[m.getMonth()]} {m.getFullYear()}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ position: "relative" }}>
        {todayPct != null && (
          <div style={{
            position: "absolute",
            left: `calc(200px + ${todayPct}% * (100% - 200px) / 100)`,
            top: 0, bottom: 0, width: 1.5,
            background: "var(--color-accent)", zIndex: 1, pointerEvents: "none",
          }} />
        )}
        {dated.length === 0 ? (
          <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 12, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
            No scheduled projects in this range.
          </div>
        ) : (
          dated.map(({ p, startMs, endMs }) => {
            const leftPct = Math.max(0, ((startMs - rangeStart) / totalMs) * 100);
            const widthPct = Math.max(1.5, ((Math.min(endMs, rangeEnd) - Math.max(startMs, rangeStart)) / totalMs) * 100);
            const projectColor = colorForEmail(p.id);
            const owner = userMeta(p.ownerEmail, users);
            return (
              <div key={p.id} style={{
                display: "grid", gridTemplateColumns: "200px 1fr", borderBottom: "1px solid var(--color-border)",
                alignItems: "center", minHeight: 36,
              }}>
                <button
                  onClick={() => router.push(`/workspace/${companyId}/${p.id}`)}
                  style={{
                    background: "transparent", border: "none", padding: "8px 10px", cursor: "pointer", fontFamily: "inherit",
                    textAlign: "left", display: "flex", alignItems: "center", gap: 6, minWidth: 0,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: projectColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.name}
                  </span>
                </button>
                <div style={{ position: "relative", height: 28 }}>
                  <button
                    onClick={() => router.push(`/workspace/${companyId}/${p.id}`)}
                    title={`${fmtDate(p.startDate)} → ${fmtDate(p.endDate)}`}
                    style={{
                      position: "absolute",
                      left: `${leftPct}%`, width: `${widthPct}%`,
                      top: 4, bottom: 4,
                      background: `${projectColor}DD`,
                      border: "none", borderRadius: 6,
                      cursor: "pointer", fontFamily: "inherit",
                      color: "white", fontSize: 11, fontWeight: 600,
                      padding: "0 8px", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 6,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}
                  >
                    {owner && <Avatar user={owner} size={16} />}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
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
            {undated.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/workspace/${companyId}/${p.id}`)}
                style={{
                  background: "rgba(0,0,0,0.04)", border: "1px solid var(--color-border)",
                  borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 500,
                  color: "var(--color-text-secondary)", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
