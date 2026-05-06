"use client";

import { useEffect, useMemo, useState } from "react";

interface ProjectListItem {
  id: string;
  name: string;
  companyId: string;
  companyName?: string;
}

interface SectionListItem {
  id: string;
  name: string;
  projectId: string;
}

/** Destination picker. Shows the current project's sections first; clicking
 *  "Move out of project" expands a search-driven list of every other
 *  (project, section) pair the user can see (plus a "no section" option per
 *  project). Picking a destination calls onMove(projectId, sectionId).
 */
export function MoveToPanel({
  currentProjectId,
  currentSectionId,
  onMove,
  onClose,
}: {
  currentProjectId: string;
  currentSectionId: string | null;
  onMove: (projectId: string, sectionId: string | null) => Promise<void>;
  onClose?: () => void;
}) {
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [currentSections, setCurrentSections] = useState<SectionListItem[] | null>(null);
  const [otherSectionsByProject, setOtherSectionsByProject] = useState<Map<string, SectionListItem[]>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [otherQuery, setOtherQuery] = useState("");

  // Always load: current project's sections (so they render immediately).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/projects/${currentProjectId}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = (await r.json()) as { sections?: SectionListItem[] };
        if (!cancelled) setCurrentSections(d.sections ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load sections");
      }
    })();
    return () => { cancelled = true; };
  }, [currentProjectId]);

  // Load other projects + their sections only when the user expands "Move out of project".
  useEffect(() => {
    if (!showOther || projects) return;
    let cancelled = false;
    (async () => {
      try {
        const [projRes, companiesRes] = await Promise.all([
          fetch("/api/projects"),
          fetch("/api/companies").catch(() => null),
        ]);
        if (!projRes.ok) throw new Error(`HTTP ${projRes.status}`);
        const projData = (await projRes.json()) as {
          projects: { id: string; name: string; companyId: string }[];
        };
        const companyNames = new Map<string, string>();
        if (companiesRes && companiesRes.ok) {
          const cd = (await companiesRes.json()) as { companies?: { id: string; name: string }[] };
          for (const c of cd.companies ?? []) companyNames.set(c.id, c.name);
        }
        if (cancelled) return;
        const others: ProjectListItem[] = projData.projects
          .filter((p) => p.id !== currentProjectId)
          .map((p) => ({
            id: p.id,
            name: p.name,
            companyId: p.companyId,
            companyName: companyNames.get(p.companyId),
          }));
        setProjects(others);

        const map = new Map<string, SectionListItem[]>();
        await Promise.all(others.map(async (p) => {
          const r = await fetch(`/api/projects/${p.id}`);
          if (!r.ok) return;
          const d = (await r.json()) as { sections?: SectionListItem[] };
          map.set(p.id, d.sections ?? []);
        }));
        if (!cancelled) setOtherSectionsByProject(map);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load projects");
      }
    })();
    return () => { cancelled = true; };
  }, [showOther, projects, currentProjectId]);

  const otherEntries = useMemo(() => {
    if (!projects) return [];
    type Entry = {
      projectId: string;
      sectionId: string;
      projectName: string;
      sectionName: string;
      companyName?: string;
    };
    const sorted = [...projects].sort((a, b) => {
      const c = (a.companyName ?? "").localeCompare(b.companyName ?? "");
      return c !== 0 ? c : a.name.localeCompare(b.name);
    });
    const out: Entry[] = [];
    for (const p of sorted) {
      for (const s of otherSectionsByProject.get(p.id) ?? []) {
        out.push({
          projectId: p.id,
          sectionId: s.id,
          projectName: p.name,
          sectionName: s.name,
          companyName: p.companyName,
        });
      }
    }
    const q = otherQuery.trim().toLowerCase();
    if (!q) return out;
    return out.filter((d) => {
      const hay = [d.projectName, d.companyName ?? "", d.sectionName].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [projects, otherSectionsByProject, otherQuery]);

  async function pick(projectId: string, sectionId: string | null) {
    if (busy) return;
    if (projectId === currentProjectId && sectionId === currentSectionId) return;
    setBusy(true);
    try {
      await onMove(projectId, sectionId);
      onClose?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Move failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ overflowY: "auto", padding: 4, maxHeight: 420 }}>
        {error && (
          <div style={{ padding: "8px 10px", fontSize: 12, color: "#B91C1C" }}>{error}</div>
        )}

        <div style={{
          padding: "6px 10px",
          fontSize: 11, fontWeight: 600,
          color: "var(--color-text-tertiary)",
          textTransform: "uppercase", letterSpacing: "0.04em",
        }}>
          Sections in this project
        </div>

        {!currentSections && !error && (
          <div style={{ padding: "6px 10px", fontSize: 12, color: "var(--color-text-tertiary)" }}>
            Loading…
          </div>
        )}

        {currentSections && currentSections.length === 0 && (
          <div style={{ padding: "6px 10px", fontSize: 12, color: "var(--color-text-tertiary)" }}>
            No sections
          </div>
        )}

        {currentSections?.map((s) => (
          <SectionRow
            key={s.id}
            label={s.name}
            here={s.id === currentSectionId}
            busy={busy}
            onClick={() => pick(currentProjectId, s.id)}
          />
        ))}

        <div style={{ height: 1, background: "var(--color-border)", margin: "8px 6px" }} />

        {!showOther ? (
          <button
            type="button"
            onClick={() => setShowOther(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "8px 10px", borderRadius: 6,
              background: "transparent", border: "none", textAlign: "left",
              cursor: "pointer", fontFamily: "inherit",
              color: "var(--color-accent)", fontWeight: 600, fontSize: 13,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,113,227,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Move out of project
          </button>
        ) : (
          <>
            <div style={{ padding: "4px 6px 6px" }}>
              <input
                autoFocus
                placeholder="Search project or section…"
                value={otherQuery}
                onChange={(e) => setOtherQuery(e.target.value)}
                style={{
                  width: "100%", border: "1px solid var(--color-border)",
                  borderRadius: 6, outline: "none",
                  padding: "5px 8px", fontSize: 12, fontFamily: "inherit",
                  background: "white",
                }}
              />
            </div>

            {!projects && (
              <div style={{ padding: "6px 10px", fontSize: 12, color: "var(--color-text-tertiary)" }}>
                Loading projects…
              </div>
            )}

            {projects && otherEntries.length === 0 && (
              <div style={{ padding: "6px 10px", fontSize: 12, color: "var(--color-text-tertiary)" }}>
                No matches
              </div>
            )}

            {otherEntries.map((d, i) => {
              const projLabel = d.companyName ? `${d.companyName} · ${d.projectName}` : d.projectName;
              const prev = otherEntries[i - 1];
              const newBlock = !prev || prev.projectId !== d.projectId;
              return (
                <div key={`s-${d.sectionId}`}>
                  {newBlock && i > 0 && (
                    <div style={{ height: 1, background: "var(--color-border)", margin: "4px 6px" }} />
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => pick(d.projectId, d.sectionId)}
                    title={`Move to ${projLabel} → ${d.sectionName}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", padding: "7px 10px", borderRadius: 6,
                      background: "transparent", border: "none", textAlign: "left",
                      cursor: busy ? "default" : "pointer",
                      fontFamily: "inherit", color: "var(--color-text-primary)",
                    }}
                    onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {d.sectionName}
                      </div>
                      <div style={{
                        fontSize: 11, color: "var(--color-text-tertiary)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {projLabel}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function SectionRow({
  label, here, busy, onClick,
}: {
  label: string;
  here: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy || here}
      onClick={onClick}
      title={here ? "Currently here" : `Move to ${label}`}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: "100%", padding: "7px 10px", borderRadius: 6,
        background: "transparent", border: "none", textAlign: "left",
        cursor: busy || here ? "default" : "pointer",
        fontFamily: "inherit", color: "var(--color-text-primary)",
        opacity: here ? 0.55 : 1,
        fontSize: 13, fontWeight: 500,
      }}
      onMouseEnter={(e) => {
        if (busy || here) return;
        e.currentTarget.style.background = "rgba(0,0,0,0.05)";
      }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      {here && (
        <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", flexShrink: 0 }}>
          here
        </span>
      )}
    </button>
  );
}
