"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Avatar,
  AvatarStack,
  DirectoryUser,
  Modal,
  MultiUserPicker,
  PROJECT_STATUS_META,
  fmtDate,
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  useUsers,
  userMeta,
} from "../_shared";
import { TRACKER_STYLE, computeTracker } from "@/lib/tracker";

type ProjectStatus = "planning" | "active" | "on_hold" | "done" | "archived";

interface ProjectRow {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  ownerEmail: string | null;
  startDate: string | null;
  endDate: string | null;
  status: ProjectStatus;
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

export default function CompanyPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const users = useUsers();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/companies/${companyId}`, { cache: "no-store" }),
        fetch(`/api/projects?companyId=${companyId}`, { cache: "no-store" }),
      ]);
      if (!cRes.ok) throw new Error(`HTTP ${cRes.status}`);
      if (!pRes.ok) throw new Error(`HTTP ${pRes.status}`);
      const cJson = (await cRes.json()) as CompanyDetail;
      const pJson = (await pRes.json()) as { projects: ProjectRow[] };
      setCompany(cJson);
      setProjects(pJson.projects);
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

      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} users={users} />
          ))}
        </div>
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
          ownerEmail: ownerEmail || null,
          startDate: startDate || null,
          endDate: endDate || null,
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Primary owner">
            <select value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} style={inputStyle}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.email} value={u.email}>{u.label}</option>)}
            </select>
          </Field>
          <div />
          <Field label="Start date">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="End date">
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          </Field>
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
