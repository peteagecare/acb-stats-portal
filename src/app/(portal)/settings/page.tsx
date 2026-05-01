"use client";

import { useEffect, useState } from "react";

interface Goals {
  leadGoalPerMonth: number | null;
  prospectsGoalPerMonth: number | null;
  visitsGoalPerMonth: number | null;
  contactsGoalPerMonth: number | null;
  siteVisitsGoalPerWeek: number | null;
  installsGoalPerMonth: number | null;
  ppcGoalPerMonth: number | null;
  seoGoalPerMonth: number | null;
  contentGoalPerMonth: number | null;
  otherGoalPerMonth: number | null;
  tvGoalPerMonth: number | null;
  ppcPercentGoal: number | null;
  seoPercentGoal: number | null;
  contentPercentGoal: number | null;
  otherPercentGoal: number | null;
  tvPercentGoal: number | null;
}

const DEFAULT_GOALS: Goals = {
  leadGoalPerMonth: null,
  prospectsGoalPerMonth: null,
  visitsGoalPerMonth: null,
  contactsGoalPerMonth: null,
  siteVisitsGoalPerWeek: null,
  installsGoalPerMonth: 32,
  ppcGoalPerMonth: null,
  seoGoalPerMonth: null,
  contentGoalPerMonth: null,
  otherGoalPerMonth: null,
  tvGoalPerMonth: null,
  ppcPercentGoal: null,
  seoPercentGoal: null,
  contentPercentGoal: null,
  otherPercentGoal: null,
  tvPercentGoal: 10,
};

function parseDraft(val: string): number | null {
  const trimmed = val.trim();
  if (trimmed === "") return null;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type GoalKey = keyof Goals;

export default function SettingsPage() {
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [drafts, setDrafts] = useState<Record<GoalKey, string>>(() =>
    Object.fromEntries(Object.keys(DEFAULT_GOALS).map((k) => [k, ""])) as Record<GoalKey, string>,
  );
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/goals")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const merged = { ...DEFAULT_GOALS, ...(data ?? {}) };
        setGoals(merged);
        setDrafts(
          Object.fromEntries(
            (Object.keys(merged) as GoalKey[]).map((k) => [k, merged[k] != null ? String(merged[k]) : ""]),
          ) as Record<GoalKey, string>,
        );
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function update(key: GoalKey, value: string) {
    setDrafts((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const updated: Goals = { ...goals };
    (Object.keys(drafts) as GoalKey[]).forEach((k) => {
      updated[k] = parseDraft(drafts[k]);
    });
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error("Save failed");
      setGoals(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "28px 28px 48px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
            Goals
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
            Set monthly targets. Leave blank to clear a target — progress bars will show no goal.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saved && (
            <span style={{ fontSize: 12, color: "#107A3E", background: "#E3F5EA", padding: "6px 10px", borderRadius: 999, fontWeight: 600 }}>
              ✓ Saved
            </span>
          )}
          {error && (
            <span style={{ fontSize: 12, color: "#9E1A1E", background: "#FCE6E7", padding: "6px 10px", borderRadius: 999, fontWeight: 600 }}>
              {error}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !loaded}
            style={{
              background: "var(--color-accent)",
              color: "white",
              border: "none",
              padding: "10px 18px",
              borderRadius: "var(--radius-button)",
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Primary goals */}
      <Section title="Top-of-funnel" description="Whole-business monthly targets.">
        <Grid>
          <GoalInput id="contactsGoalPerMonth" label="Contacts per month" hint="New HubSpot contacts created" drafts={drafts} update={update} disabled={!loaded} />
          <GoalInput id="prospectsGoalPerMonth" label="Prospects per month" hint="Low-intent enquiries (brochures, flipbook, etc.)" drafts={drafts} update={update} disabled={!loaded} />
          <GoalInput id="leadGoalPerMonth" label="Leads per month" hint="High-intent: contact form, callback, phone call" drafts={drafts} update={update} disabled={!loaded} />
          <GoalInput id="visitsGoalPerMonth" label="Home visits per month" hint="Total home visits booked in the month" drafts={drafts} update={update} disabled={!loaded} />
          <GoalInput id="siteVisitsGoalPerWeek" label="Site visits per week" hint="Per-week upcoming calendar target" drafts={drafts} update={update} disabled={!loaded} />
          <GoalInput id="installsGoalPerMonth" label="Installs per month" hint="Completed installations per month" drafts={drafts} update={update} disabled={!loaded} />
        </Grid>
      </Section>

      {/* Per-team goals */}
      <Section
        title="Per-team contacts (percent of total)"
        description="Each team's share of monthly contacts. Percent targets use the Contacts-per-month target above."
      >
        <Grid>
          <GoalInput id="ppcPercentGoal" label="PPC % of contacts" suffix="%" drafts={drafts} update={update} disabled={!loaded} />
          <GoalInput id="seoPercentGoal" label="SEO % of contacts" suffix="%" drafts={drafts} update={update} disabled={!loaded} />
          <GoalInput id="contentPercentGoal" label="Content % of contacts" suffix="%" drafts={drafts} update={update} disabled={!loaded} />
          <GoalInput id="tvPercentGoal" label="TV % of contacts" suffix="%" drafts={drafts} update={update} disabled={!loaded} />
        </Grid>
      </Section>

      <Section
        title="Per-team contacts (absolute)"
        description="Use these if you prefer an exact monthly count rather than a percent. Percent values above take priority when both are set."
      >
        <Grid>
          <GoalInput id="ppcGoalPerMonth" label="PPC contacts / month" drafts={drafts} update={update} disabled={!loaded} />
          <GoalInput id="seoGoalPerMonth" label="SEO contacts / month" drafts={drafts} update={update} disabled={!loaded} />
          <GoalInput id="contentGoalPerMonth" label="Content contacts / month" drafts={drafts} update={update} disabled={!loaded} />
          <GoalInput id="tvGoalPerMonth" label="TV contacts / month" drafts={drafts} update={update} disabled={!loaded} />
        </Grid>
      </Section>

      <Section title="Tasks" description="Workspace-wide tags for categorising tasks (e.g. Facebook, SEO, Brochure).">
        <TagsManager />
      </Section>

      <div style={{ marginTop: 28, fontSize: 12, color: "var(--color-text-tertiary)" }}>
        Manage people who can access this portal on the{" "}
        <a href="/users" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
          Users
        </a>{" "}
        page.
      </div>
    </div>
  );
}

interface TagRow { id: string; name: string; color: string; createdByEmail: string; createdAt: string; }

function TagsManager() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const refresh = async () => {
    setLoading(true);
    const res = await fetch("/api/tags", { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as { tags: TagRow[] };
      setTags(json.tags);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  async function create() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) { setNewName(""); await refresh(); }
    } finally { setCreating(false); }
  }
  async function rename(id: string, name: string) {
    const res = await fetch(`/api/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) refresh();
  }
  async function recolor(id: string, color: string) {
    await fetch(`/api/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
    refresh();
  }
  async function remove(id: string, name: string) {
    if (!confirm(`Delete tag "${name}"? It will be removed from every task.`)) return;
    const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
    if (res.ok) refresh();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") create(); }}
          placeholder="New tag name (e.g. Facebook)"
          style={{
            flex: 1, border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-button)", padding: "8px 12px",
            fontSize: 14, color: "var(--color-text-primary)",
            background: "white", outline: "none", fontFamily: "inherit",
          }}
        />
        <button
          onClick={create}
          disabled={creating || !newName.trim()}
          style={{
            background: "var(--color-accent)", color: "white", border: "none",
            padding: "8px 16px", borderRadius: "var(--radius-button)",
            fontSize: 13, fontWeight: 600, cursor: creating ? "wait" : "pointer",
            opacity: creating || !newName.trim() ? 0.6 : 1,
          }}
        >
          {creating ? "Adding…" : "Add tag"}
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Loading…</div>
      ) : tags.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>No tags yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tags.map((t) => <TagRowEdit key={t.id} tag={t} onRename={rename} onRecolor={recolor} onRemove={remove} />)}
        </div>
      )}
    </div>
  );
}

function TagRowEdit({
  tag, onRename, onRecolor, onRemove,
}: {
  tag: TagRow;
  onRename: (id: string, name: string) => void;
  onRecolor: (id: string, color: string) => void;
  onRemove: (id: string, name: string) => void;
}) {
  const [name, setName] = useState(tag.name);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 10px", borderRadius: 10,
      background: "white", border: "1px solid var(--color-border)",
    }}>
      <input
        type="color"
        value={tag.color}
        onChange={(e) => onRecolor(tag.id, e.target.value)}
        style={{ width: 28, height: 28, padding: 0, border: "none", background: "transparent", cursor: "pointer" }}
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => { if (name.trim() && name !== tag.name) onRename(tag.id, name.trim()); else setName(tag.name); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        style={{
          flex: 1, border: "1px solid transparent",
          borderRadius: 8, padding: "6px 8px", fontSize: 13,
          fontFamily: "inherit", color: "var(--color-text-primary)",
          background: "transparent", outline: "none",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
      />
      <button
        onClick={() => onRemove(tag.id, tag.name)}
        style={{
          background: "transparent", border: "none",
          color: "var(--color-text-tertiary)", cursor: "pointer", padding: 6, display: "flex",
        }}
        aria-label="Delete tag"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        </svg>
      </button>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        padding: 22,
        marginBottom: 14,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>{title}</h2>
      <p style={{ margin: "4px 0 16px", fontSize: 12, color: "var(--color-text-secondary)" }}>{description}</p>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
      {children}
    </div>
  );
}

function GoalInput({
  id,
  label,
  hint,
  suffix,
  drafts,
  update,
  disabled,
}: {
  id: GoalKey;
  label: string;
  hint?: string;
  suffix?: string;
  drafts: Record<GoalKey, string>;
  update: (id: GoalKey, v: string) => void;
  disabled: boolean;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>{label}</span>
      {hint && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{hint}</span>}
      <div style={{ position: "relative" }}>
        <input
          type="number"
          min="0"
          step="any"
          placeholder="—"
          disabled={disabled}
          value={drafts[id]}
          onChange={(e) => update(id, e.target.value)}
          style={{
            width: "100%",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-button)",
            padding: suffix ? "8px 28px 8px 12px" : "8px 12px",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--color-text-primary)",
            background: "white",
            outline: "none",
            fontFamily: "inherit",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
        />
        {suffix && (
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-tertiary)", fontSize: 12 }}>
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}
