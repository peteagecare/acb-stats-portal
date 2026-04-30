"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  Modal,
} from "../_shared";
import { WorkspaceNav } from "../_nav";

interface CompanyRow {
  id: string;
  name: string;
  description: string | null;
  accessMode: "everyone" | "restricted";
  createdAt: string;
  createdByEmail: string;
  projectCount: number;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/companies", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { companies: CompanyRow[] };
      setCompanies(json.companies);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div style={{ padding: "32px 36px 64px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 18, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Workspace</h1>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
            Companies, projects and tasks.
          </p>
        </div>
        <button onClick={() => setCreating(true)} style={{ ...primaryButtonStyle, marginLeft: "auto" }}>
          + New company
        </button>
      </div>

      <WorkspaceNav current="companies" />

      {error && (
        <div style={{ padding: 16, background: "#FEE2E2", color: "#991B1B", borderRadius: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {companies === null && !error && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>Loading…</div>
      )}

      {companies && companies.length === 0 && (
        <div style={{
          padding: "48px 24px", textAlign: "center",
          background: "var(--bg-card)", borderRadius: 18, boxShadow: "var(--shadow-card)",
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No companies yet</div>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px" }}>
            Create your first company to start adding projects and tasks.
          </p>
          <button onClick={() => setCreating(true)} style={primaryButtonStyle}>+ New company</button>
        </div>
      )}

      {companies && companies.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 14,
        }}>
          {companies.map((c) => (
            <Link
              key={c.id}
              href={`/workspace/${c.id}`}
              style={{
                display: "block", padding: "18px 18px 16px",
                background: "var(--bg-card)", borderRadius: 18,
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: "linear-gradient(135deg,#0071E3,#9333EA)",
                  color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700,
                }}>
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                    {c.projectCount} project{c.projectCount === 1 ? "" : "s"}
                    {c.accessMode === "restricted" && " · restricted"}
                  </div>
                </div>
              </div>
              {c.description && (
                <p style={{
                  fontSize: 12, color: "var(--color-text-secondary)", margin: 0,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {c.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <NewCompanyModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh(); }} />
      )}
    </div>
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
