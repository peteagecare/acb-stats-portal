"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { TagPicker, TagPillList, useTags } from "./_tags";
import { Comments } from "./_collaboration";
import { useTaskContextMenu } from "./_task-context-menu";
import { InlineTaskTitle } from "./_inline-title";
import { MoveToButton } from "./_move-to-button";
import { LinkifiedTextarea } from "./_linkified-textarea";
import { DatePicker, EnumPicker, ProjectPicker, UserPicker } from "@/app/components/Pickers";

/* Dashboard-wide handler for opening a task in a side panel without
 * navigating away. Children call this from click handlers; the page
 * provides the implementation that fetches + renders DashboardTaskPanel. */
const TaskOpenContext = createContext<((id: string) => void) | null>(null);
function useOpenTask(): ((id: string) => void) | null {
  return useContext(TaskOpenContext);
}

/* Refresh-the-dashboard hook, used by leaf task UIs that mutate (e.g. delete
 * via right-click) and need the page-level state to reload. */
const TaskRefreshContext = createContext<(() => Promise<void> | void) | null>(null);
function useTaskRefresh(): (() => Promise<void> | void) | null {
  return useContext(TaskRefreshContext);
}

interface DashboardTask {
  id: string;
  title: string;
  ownerEmail: string | null;
  createdByEmail: string;
  sectionId: string | null;
  startDate: string | null;
  endDate: string | null;
  priority: "low" | "medium" | "high" | null;
  completed: boolean;
  completedAt: string | null;
  parentTaskId: string | null;
  order: number;
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

interface InboxTask {
  id: string;
  title: string;
  ownerEmail: string;
  completed: boolean;
  endDate: string | null;
  order: number;
  createdAt: string;
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
  const [inbox, setInbox] = useState<InboxTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [dRes, cRes, uRes, iRes] = await Promise.all([
        fetch("/api/workspace/dashboard", { cache: "no-store" }),
        fetch("/api/companies", { cache: "no-store" }),
        fetch("/api/notes/unsorted-tasks", { cache: "no-store" }),
        fetch("/api/inbox-tasks", { cache: "no-store" }),
      ]);
      if (!dRes.ok) throw new Error(`HTTP ${dRes.status}`);
      if (!cRes.ok) throw new Error(`HTTP ${cRes.status}`);
      const d = (await dRes.json()) as { me: string; tasks: DashboardTask[] };
      const c = (await cRes.json()) as { companies: CompanyRow[] };
      const u = uRes.ok ? ((await uRes.json()) as { tasks: UnsortedNoteTask[] }) : { tasks: [] };
      const i = iRes.ok ? ((await iRes.json()) as { tasks: InboxTask[] }) : { tasks: [] };
      setData(d);
      setCompanies(c.companies);
      setUnsorted(u.tasks);
      setInbox(i.tasks);
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
    <TaskOpenContext.Provider value={setSelectedTaskId}>
    <TaskRefreshContext.Provider value={refresh}>
    <div className="wsp-page" style={{ padding: "28px 32px 56px" }}>
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
          <QuickInbox
            tasks={inbox}
            companies={companiesWithProjects}
            onChanged={refresh}
          />
          {unsorted.length > 0 && (
            <UnsortedNotes
              tasks={unsorted}
              users={users}
              companies={companiesWithProjects}
              onChanged={refresh}
            />
          )}
          <CompaniesGrid companies={companies} onNew={() => setCreatingCompany(true)} />
          <TasksTabs data={data} users={users} setData={setData} onChanged={refresh} />
          <AssignedByMe data={data} users={users} />
          <PeopleWidget tasks={data.tasks} users={users} />
        </div>
      )}

      {creatingCompany && (
        <NewCompanyModal onClose={() => setCreatingCompany(false)} onCreated={() => { setCreatingCompany(false); refresh(); }} />
      )}

      {selectedTaskId && data && (
        <DashboardTaskPanel
          taskId={selectedTaskId}
          dashboardTask={data.tasks.find((t) => t.id === selectedTaskId) ?? null}
          users={users}
          currentEmail={data.me}
          onClose={() => setSelectedTaskId(null)}
          onChanged={refresh}
        />
      )}
    </div>
    </TaskRefreshContext.Provider>
    </TaskOpenContext.Provider>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tasks.find((t) => t.id === selectedId) ?? null;
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
            onOpen={() => setSelectedId(t.id)}
          />
        ))}
      </div>

      {selected && (
        <UnsortedTaskPanel
          task={selected}
          users={users}
          companies={companies}
          onClose={() => setSelectedId(null)}
          onAssign={(projectId) => assign(selected, projectId)}
          onComplete={() => complete(selected)}
          onDelete={() => { remove(selected); setSelectedId(null); }}
          onSetField={(patch) => setField(selected, patch)}
          onSetTitle={async (title) => {
            const res = await fetch(`/api/notes/${selected.noteId}/tasks/${selected.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title }),
            });
            if (res.ok) onChanged();
          }}
        />
      )}
    </section>
  );
}

/* ── Quick Inbox: personal unsorted to-dos, not tied to a project ── */

function QuickInbox({
  tasks, companies, onChanged,
}: {
  tasks: InboxTask[];
  companies: CompanyWithProjects[];
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  async function add() {
    const v = draft.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/inbox-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: v }),
      });
      if (res.ok) {
        setDraft("");
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: object) {
    const res = await fetch(`/api/inbox-tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) onChanged();
  }
  async function remove(id: string) {
    const res = await fetch(`/api/inbox-tasks/${id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }
  async function promote(id: string, projectId: string) {
    const res = await fetch(`/api/inbox-tasks/${id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    if (res.ok) onChanged();
  }

  return (
    <section style={{
      background: "var(--bg-card)", borderRadius: 18,
      padding: "16px 20px 8px",
      boxShadow: "var(--shadow-card)",
      border: "1px solid #93C5FD",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{
          fontSize: 11, fontWeight: 700,
          padding: "2px 8px", borderRadius: 999,
          background: "#DBEAFE", color: "#1E40AF",
          textTransform: "uppercase", letterSpacing: 0.5,
        }}>
          {tasks.length} {tasks.length === 1 ? "to sort" : "to sort"}
        </span>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Quick Inbox</h2>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>
        A quick place to capture to-dos. Add to a project when you&apos;re ready.
      </p>

      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }}
        disabled={busy}
        placeholder="Add a quick to-do and press Enter…"
        style={{
          width: "100%",
          padding: "8px 10px", borderRadius: 8,
          border: "1px solid var(--color-border)",
          background: "white",
          fontSize: 13, fontFamily: "inherit",
          marginBottom: 8,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column" }}>
        {tasks.map((t) => (
          <InboxRow
            key={t.id}
            task={t}
            companies={companies}
            onOpen={() => setSelectedId(t.id)}
            onComplete={() => patch(t.id, { completed: true })}
            onDelete={() => remove(t.id)}
            onSetEndDate={(iso) => patch(t.id, { endDate: iso })}
            onSetTitle={(title) => patch(t.id, { title })}
            onPromote={(pid) => promote(t.id, pid)}
          />
        ))}
        {tasks.length === 0 && (
          <div style={{ padding: "8px 4px", fontSize: 12, color: "var(--color-text-tertiary)" }}>
            Nothing in your inbox.
          </div>
        )}
      </div>

      {selected && (
        <InboxTaskPanel
          task={selected}
          companies={companies}
          onClose={() => setSelectedId(null)}
          onSetTitle={(title) => patch(selected.id, { title })}
          onSetEndDate={(iso) => patch(selected.id, { endDate: iso })}
          onComplete={() => { patch(selected.id, { completed: true }); setSelectedId(null); }}
          onDelete={() => { remove(selected.id); setSelectedId(null); }}
          onPromote={(pid) => { promote(selected.id, pid); setSelectedId(null); }}
        />
      )}
    </section>
  );
}

function InboxRow({
  task, companies, onOpen, onComplete, onDelete, onSetEndDate, onSetTitle, onPromote,
}: {
  task: InboxTask;
  companies: CompanyWithProjects[];
  onOpen: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onSetEndDate: (iso: string | null) => void;
  onSetTitle: (title: string) => void;
  onPromote: (projectId: string) => void;
}) {
  const { onContextMenu, menu } = useTaskContextMenu({
    taskTitle: task.title,
    onDelete,
  });
  return (
    <>
    <div
      className="unsorted-row"
      onContextMenu={onContextMenu}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "6px 4px", borderTop: "1px solid var(--color-border)",
      }}
    >
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
      <div style={{ flex: 1, minWidth: 200, padding: "4px 6px" }}>
        <InlineTaskTitle
          title={task.title}
          fontSize={14}
          onSingleClick={onOpen}
          onSave={async (next) => onSetTitle(next)}
        />
      </div>

      <DatePicker value={task.endDate} onChange={onSetEndDate}>
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

      <ProjectPicker
        selected={null}
        companies={companies}
        onChange={(v) => { if (v) onPromote(v); }}
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
    {menu}
    </>
  );
}

function InboxTaskPanel({
  task, companies, onClose, onSetTitle, onSetEndDate, onComplete, onDelete, onPromote,
}: {
  task: InboxTask;
  companies: CompanyWithProjects[];
  onClose: () => void;
  onSetTitle: (title: string) => void;
  onSetEndDate: (iso: string | null) => void;
  onComplete: () => void;
  onDelete: () => void;
  onPromote: (projectId: string) => void;
}) {
  const [title, setTitle] = useState(task.title);
  useEffect(() => { setTitle(task.title); }, [task.id, task.title]);

  function commitTitle() {
    const v = title.trim();
    if (!v || v === task.title) { setTitle(task.title); return; }
    onSetTitle(v);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", zIndex: 60,
        display: "flex", justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, height: "100%",
          background: "white", boxShadow: "var(--shadow-modal)",
          padding: "20px 24px 24px", overflowY: "auto",
          animation: "slideIn 220ms var(--ease-apple)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <button
            onClick={onComplete}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 999,
              background: "transparent",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="4,12 9,17 20,6" /></svg>
            Mark complete
          </button>
          <span style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: 4 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          style={{
            fontSize: 22, fontWeight: 600, fontFamily: "inherit",
            border: "none", outline: "none", padding: "4px 0",
            marginBottom: 14, background: "transparent",
            color: "var(--color-text-primary)",
          }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 10, alignItems: "center", fontSize: 13 }}>
          <span style={{ color: "var(--color-text-tertiary)" }}>Due date</span>
          <DatePicker value={task.endDate} onChange={onSetEndDate}>
            {({ onClick, ref }) => (
              <button
                ref={ref} onClick={onClick} type="button"
                style={{
                  padding: "6px 10px", borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "white", textAlign: "left",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13,
                  color: task.endDate ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                }}
              >
                {task.endDate ? fmtDate(task.endDate) : "—"}
              </button>
            )}
          </DatePicker>

          <span style={{ color: "var(--color-text-tertiary)" }}>Project</span>
          <ProjectPicker
            selected={null}
            companies={companies}
            onChange={(v) => { if (v) onPromote(v); }}
          >
            {({ onClick, ref }) => (
              <button
                ref={ref} onClick={onClick} type="button"
                style={{
                  padding: "6px 10px", borderRadius: 8,
                  border: "1px dashed var(--color-border)",
                  background: "transparent", textAlign: "left",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13,
                  color: "var(--color-text-secondary)",
                }}
              >
                + Add to project
              </button>
            )}
          </ProjectPicker>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={onDelete}
          style={{
            marginTop: 24,
            padding: "8px 14px", borderRadius: 8,
            border: "1px solid #FCA5A5",
            background: "transparent",
            color: "#B91C1C",
            fontSize: 13, fontWeight: 500, fontFamily: "inherit",
            cursor: "pointer", alignSelf: "flex-start",
          }}
        >
          Delete task
        </button>
      </div>
    </div>
  );
}

function UnsortedTaskPanel({
  task, users, companies, onClose, onAssign, onComplete, onDelete, onSetField, onSetTitle,
}: {
  task: UnsortedNoteTask;
  users: DirectoryUser[];
  companies: CompanyWithProjects[];
  onClose: () => void;
  onAssign: (projectId: string) => void;
  onComplete: () => void;
  onDelete: () => void;
  onSetField: (patch: { ownerEmail?: string | null; endDate?: string | null }) => void;
  onSetTitle: (title: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  useEffect(() => { setTitle(task.title); }, [task.id, task.title]);
  const owner = users.find((u) => u.email === task.ownerEmail) ?? null;

  async function commitTitle() {
    const v = title.trim();
    if (!v || v === task.title) { setTitle(task.title); return; }
    await onSetTitle(v);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", zIndex: 60,
        display: "flex", justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, height: "100%",
          background: "white", boxShadow: "var(--shadow-modal)",
          padding: "20px 24px 24px", overflowY: "auto",
          animation: "slideIn 220ms var(--ease-apple)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <button
            onClick={() => { onComplete(); onClose(); }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 999,
              background: task.completed ? "#D1FAE5" : "transparent",
              border: `1px solid ${task.completed ? "#10B981" : "var(--color-border)"}`,
              color: task.completed ? "#065F46" : "var(--color-text-secondary)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="4,12 9,17 20,6" /></svg>
            {task.completed ? "Completed" : "Mark complete"}
          </button>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              background: "transparent", border: "none", cursor: "pointer",
              padding: 6, color: "var(--color-text-secondary)", display: "flex",
            }}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          style={{
            width: "100%", fontSize: 22, fontWeight: 600,
            border: "none", outline: "none", padding: "4px 0 12px",
            color: "var(--color-text-primary)", fontFamily: "inherit",
            background: "transparent",
          }}
        />

        <div style={{
          fontSize: 12, color: "var(--color-text-tertiary)",
          padding: "0 0 14px",
          borderBottom: "1px solid var(--color-border)",
          marginBottom: 14,
        }}>
          From{" "}
          <Link href={`/notes?id=${task.noteId}`} style={{ color: "var(--color-accent)", textDecoration: "none" }}>
            {task.noteTitle || "Untitled meeting"}
          </Link>
          {task.noteMeetingDate && ` · ${fmtDate(task.noteMeetingDate)}`}
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "120px 1fr",
          rowGap: 4, columnGap: 12, alignItems: "center",
          fontSize: 13,
        }}>
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Assignee</span>
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
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "6px 8px", borderRadius: 8, border: "1px solid transparent",
                  background: "transparent", cursor: "pointer", fontFamily: "inherit",
                  width: "100%", textAlign: "left",
                }}
              >
                {owner ? (
                  <>
                    <span style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: owner.color, color: "white",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700,
                    }}>{(owner.label || "?").trim().slice(0, 1).toUpperCase()}</span>
                    <span style={{ fontSize: 14 }}>{owner.label}</span>
                  </>
                ) : (
                  <>
                    <span style={{
                      width: 22, height: 22, borderRadius: "50%",
                      border: "1px dashed var(--color-border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--color-text-tertiary)", fontSize: 13,
                    }}>+</span>
                    <span style={{ fontSize: 14, color: "var(--color-text-tertiary)" }}>Unassigned</span>
                  </>
                )}
              </button>
            )}
          </UserPicker>

          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Due date</span>
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
                style={{
                  padding: "6px 8px", borderRadius: 8, border: "1px solid transparent",
                  background: "transparent", cursor: "pointer", fontFamily: "inherit",
                  width: "100%", textAlign: "left", fontSize: 14,
                  color: task.endDate ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                }}
              >
                {task.endDate ? fmtDate(task.endDate) : "—"}
              </button>
            )}
          </DatePicker>

          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Project</span>
          <ProjectPicker
            selected={null}
            companies={companies}
            onChange={(v) => { if (v) { onAssign(v); onClose(); } }}
          >
            {({ onClick, ref }) => (
              <button
                ref={ref}
                onClick={onClick}
                type="button"
                className="task-panel-control"
                style={{
                  padding: "6px 8px", borderRadius: 8, border: "1px solid transparent",
                  background: "transparent", cursor: "pointer", fontFamily: "inherit",
                  width: "100%", textAlign: "left", fontSize: 14,
                  color: "var(--color-accent)",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add to project
              </button>
            )}
          </ProjectPicker>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={onDelete}
          style={{
            marginTop: 18, padding: "8px 14px", borderRadius: 10,
            background: "transparent", border: "1px solid #FCA5A5",
            color: "#B91C1C", fontSize: 13, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start",
          }}
        >
          Delete task
        </button>
      </div>
    </div>
  );
}

function UnsortedRow({
  task, users, companies, onAssign, onComplete, onDelete, onSetField, onOpen,
}: {
  task: UnsortedNoteTask;
  users: DirectoryUser[];
  companies: CompanyWithProjects[];
  onAssign: (projectId: string) => void;
  onComplete: () => void;
  onDelete: () => void;
  onSetField: (patch: { ownerEmail?: string | null; endDate?: string | null }) => void;
  onOpen: () => void;
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
      <button
        onClick={onOpen}
        type="button"
        title="Open task"
        style={{
          flex: 1, minWidth: 200,
          padding: "4px 6px", borderRadius: 6,
          border: "none", background: "transparent",
          textAlign: "left", cursor: "pointer", fontFamily: "inherit",
          transition: "background 100ms var(--ease-apple)",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.035)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        <div style={{ fontSize: 14, color: "var(--color-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {task.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
          From:{" "}
          <span
            onClick={(e) => e.stopPropagation()}
            style={{ display: "inline" }}
          >
            <Link href={`/notes?id=${task.noteId}`} style={{ color: "inherit", textDecoration: "underline" }}>
              {task.noteTitle || "Untitled meeting"}
            </Link>
          </span>
          {task.noteMeetingDate && ` · ${fmtDate(task.noteMeetingDate)}`}
        </div>
      </button>

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

type ViewMode = "list" | "calendar";
const VIEW_KEY = "workspace-tasks-view";

/* ── Drag & drop helpers ──────────────────────────────────────────── */

type DragOps = {
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
  /** Apply a partial update locally (optimistic) and PATCH the server. */
  patchTask: (id: string, patch: Partial<Pick<DashboardTask, "endDate" | "order">>) => Promise<void>;
  /** Re-number `order` for a list of task IDs (in the new visual order) using 10-step gaps. */
  reorderGroup: (orderedIds: string[]) => Promise<void>;
};

const DragOpsContext = createContext<DragOps | null>(null);
function useDragOps(): DragOps {
  const v = useContext(DragOpsContext);
  if (!v) throw new Error("DragOpsContext not found");
  return v;
}

/** Maps a list-view bucket key to the date a dropped task should land on. */
function bucketDateFor(key: BucketKey): string | null {
  function iso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const today = new Date();
  if (key === "today") return iso(today);
  if (key === "thisWeek") return iso(endOfWeek(today));
  if (key === "nextWeek") {
    const nws = new Date(endOfWeek(today).getTime() + 24 * 3600 * 1000);
    return iso(nws);
  }
  if (key === "later") {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return iso(d);
  }
  return null; // sometime / completed → no date
}

function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dropEdge(e: React.DragEvent<HTMLElement>): "before" | "after" {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

function TasksTabs({
  data,
  users,
  setData,
  onChanged,
}: {
  data: { me: string; tasks: DashboardTask[] };
  users: DirectoryUser[];
  setData: React.Dispatch<React.SetStateAction<{ me: string; tasks: DashboardTask[] } | null>>;
  onChanged: () => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const patchTask: DragOps["patchTask"] = useCallback(
    async (id, patch) => {
      // Optimistic local update
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...(patch.endDate !== undefined ? { endDate: patch.endDate } : null),
                  ...(patch.order !== undefined ? { order: patch.order } : null),
                }
              : t,
          ),
        };
      });
      try {
        await fetch(`/api/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
      } catch {
        // best effort; refresh will reconcile
      } finally {
        onChanged();
      }
    },
    [setData, onChanged],
  );

  const reorderGroup: DragOps["reorderGroup"] = useCallback(
    async (orderedIds) => {
      const newOrders = new Map<string, number>();
      orderedIds.forEach((id, i) => newOrders.set(id, i * 10));
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) => (newOrders.has(t.id) ? { ...t, order: newOrders.get(t.id)! } : t)),
        };
      });
      await Promise.all(
        Array.from(newOrders.entries()).map(([id, order]) =>
          fetch(`/api/tasks/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order }),
          }).catch(() => null),
        ),
      );
      onChanged();
    },
    [setData, onChanged],
  );

  const dragOps: DragOps = {
    draggedId,
    setDraggedId,
    patchTask,
    reorderGroup,
  };

  return (
    <DragOpsContext.Provider value={dragOps}>
      <TasksTabsInner data={data} users={users} />
    </DragOpsContext.Provider>
  );
}

function TasksTabsInner({ data, users }: { data: { me: string; tasks: DashboardTask[] }; users: DirectoryUser[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "team" ? "team" : "mine";
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [mode, setMode] = useState<ViewMode>("list");

  // Hydrate persisted view mode after mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(VIEW_KEY);
    if (stored === "calendar" || stored === "list") setMode(stored);
  }, []);

  function changeMode(next: ViewMode) {
    setMode(next);
    if (typeof window !== "undefined") localStorage.setItem(VIEW_KEY, next);
  }

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
        <span style={{ flex: 1 }} />
        <ViewModeSwitcher value={mode} onChange={changeMode} />
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

      {mode === "list" && <TasksBuckets data={data} users={users} predicate={predicate} />}
      {mode === "calendar" && <CalendarView data={data} users={users} predicate={predicate} />}
    </section>
  );
}

function ViewModeSwitcher({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  const Btn = ({ mode, label, children }: { mode: ViewMode; label: string; children: React.ReactNode }) => (
    <button
      onClick={() => onChange(mode)}
      title={label}
      aria-label={label}
      style={{
        padding: 6, marginBottom: -1,
        background: value === mode ? "rgba(0,113,227,0.1)" : "transparent",
        border: "none",
        borderRadius: 8,
        color: value === mode ? "var(--color-accent)" : "var(--color-text-secondary)",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 2, padding: "0 0 8px" }}>
      <Btn mode="list" label="List view">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="4" cy="6" r="1" fill="currentColor" />
          <circle cx="4" cy="12" r="1" fill="currentColor" />
          <circle cx="4" cy="18" r="1" fill="currentColor" />
        </svg>
      </Btn>
      <Btn mode="calendar" label="Calendar view">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="8" y1="3" x2="8" y2="7" />
          <line x1="16" y1="3" x2="16" y2="7" />
        </svg>
      </Btn>
    </div>
  );
}

/* ─── Calendar view ─── */

const CAL_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CAL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function CalendarView({
  data, users, predicate,
}: {
  data: { me: string; tasks: DashboardTask[] };
  users: DirectoryUser[];
  predicate: (t: DashboardTask) => boolean;
}) {
  const router = useRouter();
  const openTask = useOpenTask();
  const openCalTask = (t: DashboardTask) => {
    if (openTask) openTask(t.id);
    else router.push(`/workspace/${t.companyId}/${t.projectId}?task=${t.id}`);
  };
  const [view, setView] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const tasksByDay = useMemo(() => {
    const m = new Map<string, DashboardTask[]>();
    for (const t of data.tasks) {
      if (t.parentTaskId) continue;
      if (!predicate(t)) continue;
      if (!t.endDate) continue;
      const list = m.get(t.endDate) ?? [];
      list.push(t);
      m.set(t.endDate, list);
    }
    const sortByName = (a: DashboardTask, b: DashboardTask) => a.title.localeCompare(b.title);
    for (const list of m.values()) list.sort(sortByName);
    return m;
  }, [data, predicate]);

  const startDay = view.getDay() === 0 ? 6 : view.getDay() - 1;
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  type Cell = { d: Date; otherMonth: boolean };
  const cells: Cell[] = [];
  for (let i = startDay; i > 0; i--) {
    cells.push({ d: new Date(view.getFullYear(), view.getMonth(), 1 - i), otherMonth: true });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ d: new Date(view.getFullYear(), view.getMonth(), i), otherMonth: false });
  }
  // Pad to a multiple of 7 — only as many weeks as we actually need (5 or 6).
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].d;
    cells.push({ d: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), otherMonth: true });
  }
  const weekRows = cells.length / 7;
  const today = todayStart();
  // Mon-Fri equal, Sat/Sun narrower (Pete: keep weekend small).
  const COLUMN_TEMPLATE = "repeat(5, 1.2fr) 0.65fr 0.65fr";

  function isoFor(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const dragOps = useDragOps();
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  function handleDropOn(targetIso: string) {
    const id = dragOps.draggedId;
    if (!id) return;
    dragOps.patchTask(id, { endDate: targetIso });
    dragOps.setDraggedId(null);
    setHoverIso(null);
  }

  return (
    <div style={{
      background: "var(--bg-card)", borderRadius: 14,
      boxShadow: "var(--shadow-card)", overflow: "hidden",
      display: "flex", flexDirection: "column",
      // Aim to fit the full month on a normal-height screen without page scroll.
      height: "calc(100vh - 220px)",
      minHeight: 520,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 16px",
        borderBottom: "1px solid var(--color-border)",
        flexShrink: 0,
      }}>
        <button
          onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
          aria-label="Previous month"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "var(--color-text-secondary)", display: "flex" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,6 9,12 15,18" /></svg>
        </button>
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          {CAL_MONTHS[view.getMonth()]} {view.getFullYear()}
        </div>
        <button
          onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
          aria-label="Next month"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "var(--color-text-secondary)", display: "flex" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9,6 15,12 9,18" /></svg>
        </button>
        <button
          onClick={() => { const t = new Date(); setView(new Date(t.getFullYear(), t.getMonth(), 1)); }}
          style={{
            marginLeft: 4, padding: "4px 10px",
            background: "transparent", border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
            borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
          }}
        >Today</button>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: COLUMN_TEMPLATE,
        borderBottom: "1px solid var(--color-border)", flexShrink: 0,
      }}>
        {CAL_WEEKDAYS.map((w) => (
          <div key={w} style={{
            padding: "8px 10px", fontSize: 11, fontWeight: 600,
            color: "var(--color-text-tertiary)",
            textTransform: "uppercase", letterSpacing: 0.4,
          }}>{w}</div>
        ))}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: COLUMN_TEMPLATE,
        gridTemplateRows: `repeat(${weekRows}, minmax(96px, 1fr))`,
        flex: 1, minHeight: 0,
      }}>
        {cells.map(({ d, otherMonth }, i) => {
          const iso = isoFor(d);
          const dayTasks = tasksByDay.get(iso) ?? [];
          const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
          const lastRow = Math.floor(i / 7) === weekRows - 1;
          const isHovered = hoverIso === iso;
          return (
            <div
              key={i}
              onDragOver={(e) => {
                if (!dragOps.draggedId) return;
                e.preventDefault();
                setHoverIso(iso);
              }}
              onDragLeave={(e) => {
                if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
                setHoverIso((c) => (c === iso ? null : c));
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDropOn(iso);
              }}
              style={{
                padding: "6px 6px 8px",
                borderRight: (i + 1) % 7 === 0 ? "none" : "1px solid var(--color-border)",
                borderBottom: lastRow ? "none" : "1px solid var(--color-border)",
                background: isHovered ? "rgba(0,113,227,0.08)" : otherMonth ? "rgba(0,0,0,0.015)" : "transparent",
                minWidth: 0, minHeight: 0, overflow: "hidden",
                display: "flex", flexDirection: "column",
                outline: isHovered ? "2px solid var(--color-accent)" : "none",
                outlineOffset: -2,
              }}
            >
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minWidth: 22, height: 22, borderRadius: 999,
                fontSize: 12, fontWeight: isToday ? 700 : 500,
                color: isToday ? "white" : otherMonth ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
                background: isToday ? "var(--color-accent)" : "transparent",
                marginBottom: 4,
                padding: "0 7px", alignSelf: "flex-start", flexShrink: 0,
              }}>{d.getDate()}</div>
              <div style={{
                display: "flex", flexDirection: "column", gap: 2,
                flex: 1, minHeight: 0, overflow: "hidden",
              }}>
                {dayTasks.slice(0, 4).map((t) => (
                  <CalendarTaskChip key={t.id} task={t} users={users} onClick={() => openCalTask(t)} />
                ))}
                {dayTasks.length > 4 && (
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", padding: "2px 4px" }}>
                    +{dayTasks.length - 4} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarTaskChip({ task, users, onClick }: { task: DashboardTask; users: DirectoryUser[]; onClick: () => void }) {
  const owner = userMeta(task.ownerEmail, users);
  const projectColor = colorForEmail(task.projectId);
  const dragOps = useDragOps();
  const isDragging = dragOps.draggedId === task.id;
  return (
    <button
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        dragOps.setDraggedId(task.id);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
      }}
      onDragEnd={() => dragOps.setDraggedId(null)}
      title={`${task.title} · ${task.projectName}${owner ? ` · ${owner.label}` : ""}`}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "3px 6px", borderRadius: 6,
        background: `${projectColor}1A`,
        border: "none", cursor: isDragging ? "grabbing" : "grab", fontFamily: "inherit",
        textAlign: "left", width: "100%",
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: projectColor, flexShrink: 0 }} />
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 11,
        color: task.completed ? "var(--color-text-tertiary)" : projectColor,
        textDecoration: task.completed ? "line-through" : "none",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        fontWeight: 500,
      }}>{task.title}</span>
      {owner && <Avatar user={owner} size={14} />}
    </button>
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
    const cmp = (a: DashboardTask, b: DashboardTask) => {
      if (a.order !== b.order) return a.order - b.order;
      const da = endDateMs(a.endDate) ?? Number.POSITIVE_INFINITY;
      const db = endDateMs(b.endDate) ?? Number.POSITIVE_INFINITY;
      return da - db;
    };
    out.today.sort(cmp);
    out.thisWeek.sort(cmp);
    out.nextWeek.sort(cmp);
    out.later.sort(cmp);
    out.sometime.sort(cmp);
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
          allTasksInBucket={buckets[b.key]}
        />
      ))}
    </div>
  );
}

function BucketCard({
  label, tasks, users, emptyHint, variant, allTasksInBucket,
}: {
  label: string;
  tasks: DashboardTask[];
  users: DirectoryUser[];
  emptyHint: string;
  variant: BucketKey;
  allTasksInBucket: DashboardTask[];
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
  const dragOps = useDragOps();
  const [hovered, setHovered] = useState(false);

  function handleDrop(anchorTaskId: string | null, edge: "before" | "after") {
    const id = dragOps.draggedId;
    if (!id) return;
    const allInBucket = allTasksInBucket.filter((t) => t.id !== id);
    let insertAt: number;
    if (anchorTaskId) {
      const idx = allInBucket.findIndex((t) => t.id === anchorTaskId);
      insertAt = idx < 0 ? allInBucket.length : idx + (edge === "after" ? 1 : 0);
    } else {
      insertAt = allInBucket.length;
    }

    if (variant === "completed") {
      fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      }).catch(() => null);
    } else {
      dragOps.patchTask(id, { endDate: bucketDateFor(variant) });
    }

    const orderedIds = [...allInBucket.slice(0, insertAt).map((t) => t.id), id, ...allInBucket.slice(insertAt).map((t) => t.id)];
    dragOps.reorderGroup(orderedIds);
    dragOps.setDraggedId(null);
    setHovered(false);
  }

  return (
    <div
      onDragOver={(e) => {
        if (!dragOps.draggedId) return;
        e.preventDefault();
        setHovered(true);
      }}
      onDragLeave={(e) => {
        if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
        setHovered(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        handleDrop(null, "after");
      }}
      style={{
        background: "var(--bg-card)",
        borderRadius: 18,
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
        outline: hovered ? `2px solid ${accent}` : "2px solid transparent",
        outlineOffset: -2,
        transition: "outline-color 100ms",
      }}
    >
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
              <BucketTaskRow
                key={t.id}
                task={t}
                users={users}
                todayMs={todayMs}
                onDropAt={(edge) => handleDrop(t.id, edge)}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function BucketTaskRow({
  task, users, todayMs, onDropAt,
}: {
  task: DashboardTask;
  users: DirectoryUser[];
  todayMs: number;
  onDropAt: (edge: "before" | "after") => void;
}) {
  const router = useRouter();
  const openTask = useOpenTask();
  const refresh = useTaskRefresh();
  const allTags = useTags();
  const projectColor = colorForEmail(task.projectId);
  const due = endDateMs(task.endDate);
  const overdue = due != null && due < todayMs && !task.completed;
  const owner = userMeta(task.ownerEmail, users);
  const dragOps = useDragOps();
  const [over, setOver] = useState<"before" | "after" | null>(null);
  const isDragging = dragOps.draggedId === task.id;
  const { onContextMenu, menu } = useTaskContextMenu({
    taskTitle: task.title,
    currentStartDate: task.startDate,
    currentEndDate: task.endDate,
    currentProjectId: task.projectId,
    currentSectionId: task.sectionId,
    onDelete: async () => {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      await refresh?.();
    },
    onUpdate: async (patch) => {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      await refresh?.();
    },
  });

  function open() {
    if (openTask) openTask(task.id);
    else router.push(`/workspace/${task.companyId}/${task.projectId}?task=${task.id}`);
  }
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
    <>
    <div
      onClick={open}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={(e) => {
        dragOps.setDraggedId(task.id);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
      }}
      onDragEnd={() => dragOps.setDraggedId(null)}
      onDragOver={(e) => {
        if (!dragOps.draggedId || dragOps.draggedId === task.id) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(dropEdge(e));
      }}
      onDragLeave={() => setOver(null)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const edge = dropEdge(e);
        setOver(null);
        onDropAt(edge);
      }}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 18px",
        borderTop: over === "before" ? "2px solid var(--color-accent)" : "1px solid var(--color-border)",
        borderBottom: over === "after" ? "2px solid var(--color-accent)" : "none",
        cursor: isDragging ? "grabbing" : "pointer",
        transition: "background 100ms var(--ease-apple)",
        opacity: isDragging ? 0.4 : 1,
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
      <InlineTaskTitle
        title={task.title}
        completed={task.completed}
        fontSize={14}
        onSingleClick={open}
        onSave={async (next) => {
          const res = await fetch(`/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: next }),
          });
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(j.error ?? `HTTP ${res.status}`);
          }
          await refresh?.();
        }}
      />
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
      <MoveToButton
        currentProjectId={task.projectId}
        currentSectionId={task.sectionId}
        onMove={async (projectId, sectionId) => {
          const res = await fetch(`/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(projectId !== task.projectId ? { projectId } : {}),
              sectionId,
            }),
          });
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(j.error ?? `HTTP ${res.status}`);
          }
          await refresh?.();
        }}
      />
    </div>
    {menu}
    </>
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
  const openTask = useOpenTask();
  const refresh = useTaskRefresh();
  const allTags = useTags();
  const projectColor = colorForEmail(task.projectId);
  const due = endDateMs(task.endDate);
  const todayMs = todayStart().getTime();
  const overdue = due != null && due < todayMs && !task.completed;
  const owner = userMeta(task.ownerEmail, users);
  const { onContextMenu, menu } = useTaskContextMenu({
    taskTitle: task.title,
    currentStartDate: task.startDate,
    currentEndDate: task.endDate,
    currentProjectId: task.projectId,
    currentSectionId: task.sectionId,
    onDelete: async () => {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      await refresh?.();
    },
    onUpdate: async (patch) => {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      await refresh?.();
    },
  });

  function open() {
    if (openTask) openTask(task.id);
    else router.push(`/workspace/${task.companyId}/${task.projectId}?task=${task.id}`);
  }

  return (
    <>
    <div
      onClick={open}
      onContextMenu={onContextMenu}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 4px", borderTop: "1px solid var(--color-border)",
        cursor: "pointer", transition: "background 100ms var(--ease-apple)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <InlineTaskTitle
        title={task.title}
        completed={task.completed}
        fontSize={14}
        onSingleClick={open}
        onSave={async (next) => {
          const res = await fetch(`/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: next }),
          });
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(j.error ?? `HTTP ${res.status}`);
          }
          await refresh?.();
        }}
      />
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
      <MoveToButton
        currentProjectId={task.projectId}
        currentSectionId={task.sectionId}
        onMove={async (projectId, sectionId) => {
          const res = await fetch(`/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(projectId !== task.projectId ? { projectId } : {}),
              sectionId,
            }),
          });
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(j.error ?? `HTTP ${res.status}`);
          }
          await refresh?.();
        }}
      />
    </div>
    {menu}
    </>
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

/* ─── Dashboard task panel ─── */

interface FullTask {
  id: string;
  projectId: string;
  sectionId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  ownerEmail: string | null;
  startDate: string | null;
  endDate: string | null;
  priority: "low" | "medium" | "high" | null;
  estimatedHours: number | null;
  completed: boolean;
  completedAt: string | null;
  goal: string | null;
  expectedOutcome: string | null;
  collaborators: string[];
  tagIds: string[];
  createdAt: string;
  createdByEmail: string;
}

function DashboardTaskPanel({
  taskId, dashboardTask, users, currentEmail, onClose, onChanged,
}: {
  taskId: string;
  dashboardTask: DashboardTask | null;
  users: DirectoryUser[];
  currentEmail: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [task, setTask] = useState<FullTask | null>(null);
  const [title, setTitle] = useState(dashboardTask?.title ?? "");
  const [description, setDescription] = useState("");
  const titleSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Fetch the full task on open
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tasks/${taskId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: FullTask | null) => {
        if (cancelled || !j) return;
        setTask(j);
        setTitle(j.title);
        setDescription(j.description ?? "");
      });
    return () => { cancelled = true; };
  }, [taskId]);

  async function patch(body: object) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Re-fetch the full task to keep panel in sync
    const fresh = await fetch(`/api/tasks/${taskId}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null);
    if (fresh) setTask(fresh);
    onChanged();
  }

  function saveTitleSoon(v: string) {
    setTitle(v);
    if (titleSaveRef.current) clearTimeout(titleSaveRef.current);
    titleSaveRef.current = setTimeout(() => {
      const trimmed = v.trim();
      if (!trimmed || (task && trimmed === task.title)) return;
      patch({ title: trimmed });
    }, 600);
  }

  function saveDescSoon(v: string) {
    setDescription(v);
    if (descSaveRef.current) clearTimeout(descSaveRef.current);
    descSaveRef.current = setTimeout(() => {
      patch({ description: v });
    }, 600);
  }

  async function handleDelete() {
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    onChanged();
    onClose();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const owner = task ? users.find((u) => u.email === task.ownerEmail) : null;
  const projectName = dashboardTask?.projectName;
  const companyName = dashboardTask?.companyName;
  const fullEditorHref = dashboardTask
    ? `/workspace/${dashboardTask.companyId}/${dashboardTask.projectId}?task=${taskId}`
    : "#";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", zIndex: 60,
        display: "flex", justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520, height: "100%",
          background: "white", boxShadow: "var(--shadow-modal)",
          padding: "20px 24px 24px", overflowY: "auto",
          animation: "slideIn 220ms var(--ease-apple)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <button
            onClick={() => task && patch({ completed: !task.completed })}
            disabled={!task}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 999,
              background: task?.completed ? "#D1FAE5" : "transparent",
              border: `1px solid ${task?.completed ? "#10B981" : "var(--color-border)"}`,
              color: task?.completed ? "#065F46" : "var(--color-text-secondary)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              opacity: task ? 1 : 0.5,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="4,12 9,17 20,6" /></svg>
            {task?.completed ? "Completed" : "Mark complete"}
          </button>
          <Link
            href={fullEditorHref}
            style={{
              fontSize: 12, fontWeight: 500,
              color: "var(--color-text-secondary)",
              textDecoration: "none",
              padding: "5px 10px", borderRadius: 8,
              border: "1px solid var(--color-border)",
            }}
            title="Open in project for subtasks, files, recurrence…"
          >Open full</Link>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              marginLeft: "auto", background: "transparent",
              border: "none", cursor: "pointer", padding: 6,
              color: "var(--color-text-secondary)", display: "flex",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {(companyName || projectName) && (
          <div style={{
            fontSize: 12, color: "var(--color-text-tertiary)",
            marginBottom: 6,
          }}>
            {companyName} {projectName && <>· <Link href={`/workspace/${dashboardTask?.companyId}/${dashboardTask?.projectId}`} style={{ color: "var(--color-accent)", textDecoration: "none" }}>{projectName}</Link></>}
          </div>
        )}

        <input
          value={title}
          onChange={(e) => saveTitleSoon(e.target.value)}
          placeholder="Untitled task"
          style={{
            width: "100%", fontSize: 22, fontWeight: 600,
            border: "none", outline: "none", padding: "4px 0 12px",
            color: "var(--color-text-primary)", fontFamily: "inherit",
            background: "transparent",
          }}
        />

        {!task ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13 }}>
            Loading…
          </div>
        ) : (
          <>
            <div style={{
              display: "grid", gridTemplateColumns: "120px 1fr",
              rowGap: 4, columnGap: 12, alignItems: "center",
              fontSize: 13, marginBottom: 16,
            }}>
              <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Owner</span>
              <UserPicker selected={task.ownerEmail} users={users} onChange={(v) => patch({ ownerEmail: v })}>
                {({ onClick, ref }) => (
                  <button
                    ref={ref}
                    onClick={onClick}
                    type="button"
                    className="task-panel-control"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "6px 8px", borderRadius: 8, border: "1px solid transparent",
                      background: "transparent", cursor: "pointer", fontFamily: "inherit",
                      width: "100%", textAlign: "left",
                    }}
                  >
                    {owner ? (
                      <>
                        <span style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: owner.color, color: "white",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700,
                        }}>{(owner.label || "?").trim().slice(0, 1).toUpperCase()}</span>
                        <span style={{ fontSize: 14 }}>{owner.label}</span>
                      </>
                    ) : (
                      <>
                        <span style={{
                          width: 22, height: 22, borderRadius: "50%",
                          border: "1px dashed var(--color-border)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "var(--color-text-tertiary)", fontSize: 13,
                        }}>+</span>
                        <span style={{ fontSize: 14, color: "var(--color-text-tertiary)" }}>Unassigned</span>
                      </>
                    )}
                  </button>
                )}
              </UserPicker>

              <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Start date</span>
              <DatePicker value={task.startDate} onChange={(iso) => patch({ startDate: iso })}>
                {({ onClick, ref }) => (
                  <button ref={ref} onClick={onClick} type="button" className="task-panel-control"
                    style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid transparent", background: "transparent", cursor: "pointer", width: "100%", textAlign: "left", fontSize: 14, fontFamily: "inherit", color: task.startDate ? "var(--color-text-primary)" : "var(--color-text-tertiary)" }}>
                    {task.startDate ?? "—"}
                  </button>
                )}
              </DatePicker>

              <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>End date</span>
              <DatePicker value={task.endDate} onChange={(iso) => patch({ endDate: iso })}>
                {({ onClick, ref }) => (
                  <button ref={ref} onClick={onClick} type="button" className="task-panel-control"
                    style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid transparent", background: "transparent", cursor: "pointer", width: "100%", textAlign: "left", fontSize: 14, fontFamily: "inherit", color: task.endDate ? "var(--color-text-primary)" : "var(--color-text-tertiary)" }}>
                    {task.endDate ?? "—"}
                  </button>
                )}
              </DatePicker>

              <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Priority</span>
              <EnumPicker
                selected={task.priority ?? ""}
                options={[
                  { value: "", label: "None" },
                  { value: "low", label: "Low", color: "#3730A3" },
                  { value: "medium", label: "Medium", color: "#92400E" },
                  { value: "high", label: "High", color: "#991B1B" },
                ]}
                onChange={(v) => patch({ priority: v || null })}
              >
                {({ onClick, ref }) => (
                  <button ref={ref} onClick={onClick} type="button" className="task-panel-control"
                    style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid transparent", background: "transparent", cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit" }}>
                    {task.priority ? <PriorityPill priority={task.priority} /> : <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>None</span>}
                  </button>
                )}
              </EnumPicker>

              <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", alignSelf: "start", paddingTop: 10 }}>Tags</span>
              <div style={{ padding: "4px 0" }}>
                <TagPicker selected={task.tagIds} onChange={(next) => patch({ setTagIds: next })} />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginBottom: 6 }}>Description</div>
              <LinkifiedTextarea
                value={description}
                onChange={saveDescSoon}
                placeholder="Add a description, links, or context…"
                rows={4}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 14, marginBottom: 18 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px", color: "var(--color-text-primary)" }}>Comments</h3>
              <Comments parentType="task" parentId={taskId} users={users} currentEmail={currentEmail} />
            </div>

            <div style={{ flex: 1 }} />

            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                marginTop: 10, padding: "8px 14px", borderRadius: 10,
                background: "transparent", border: "1px solid #FCA5A5",
                color: "#B91C1C", fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start",
              }}
            >Delete task</button>
          </>
        )}
      </div>

      {confirmDelete && task && (
        <div
          onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1300,
            background: "rgba(15, 23, 42, 0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "white", borderRadius: 16,
            boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
            width: "100%", maxWidth: 400,
            padding: "22px 24px 18px",
          }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Delete this task?</h2>
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--color-text-secondary)" }}>
              <strong>{task.title}</strong> will be removed. This can&apos;t be undone.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: "8px 16px", borderRadius: 10, background: "transparent", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleDelete} style={{ padding: "8px 16px", borderRadius: 10, background: "#DC2626", border: "none", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Delete task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PriorityPill({ priority }: { priority: "low" | "medium" | "high" }) {
  const meta = PRIORITY_META[priority];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 999,
      fontSize: 12, fontWeight: 600,
      background: meta.bg, color: meta.color,
    }}>{meta.label}</span>
  );
}

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
