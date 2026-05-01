"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { inputStyle, primaryButtonStyle } from "./_shared";

export interface Tag {
  id: string;
  name: string;
  color: string;
}

/** Hex → readable text color (black/white) for a colored pill background. */
function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#fff";
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  // Relative luminance
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1f2937" : "#ffffff";
}

export function tint(hex: string, alpha = 0.15): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ── shared cache so every component shares one fetch ── */

let _cache: Tag[] | null = null;
const _listeners: Array<(tags: Tag[]) => void> = [];
let _inflight: Promise<Tag[]> | null = null;

function notify(tags: Tag[]) {
  _cache = tags;
  for (const fn of _listeners) fn(tags);
}

async function fetchTags(): Promise<Tag[]> {
  const res = await fetch("/api/tags", { cache: "no-store" });
  if (!res.ok) return [];
  const json = (await res.json()) as { tags: Tag[] };
  return json.tags;
}

export async function refreshTags(): Promise<Tag[]> {
  if (_inflight) return _inflight;
  _inflight = fetchTags().then((tags) => {
    notify(tags);
    _inflight = null;
    return tags;
  });
  return _inflight;
}

export function useTags(): Tag[] {
  const [tags, setTags] = useState<Tag[]>(_cache ?? []);
  useEffect(() => {
    _listeners.push(setTags);
    if (_cache === null) refreshTags();
    return () => {
      const i = _listeners.indexOf(setTags);
      if (i >= 0) _listeners.splice(i, 1);
    };
  }, []);
  return tags;
}

/* ── Pill renderer ── */

export function TagPill({ tag, size = "sm" }: { tag: Tag; size?: "xs" | "sm" }) {
  const padding = size === "xs" ? "2px 7px" : "3px 9px";
  const fontSize = size === "xs" ? 10 : 11;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize, fontWeight: 500,
        padding, borderRadius: 999,
        background: tint(tag.color, 0.15),
        color: tag.color,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: tag.color, flexShrink: 0 }} />
      {tag.name}
    </span>
  );
}

export function TagPillList({
  tagIds, allTags, max = 4, size = "sm",
}: {
  tagIds: string[];
  allTags: Tag[];
  max?: number;
  size?: "xs" | "sm";
}) {
  const map = useMemo(() => new Map(allTags.map((t) => [t.id, t])), [allTags]);
  const tags = tagIds.map((id) => map.get(id)).filter((t): t is Tag => !!t);
  const visible = tags.slice(0, max);
  const overflow = tags.length - visible.length;
  if (tags.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {visible.map((t) => <TagPill key={t.id} tag={t} size={size} />)}
      {overflow > 0 && (
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>+{overflow}</span>
      )}
    </span>
  );
}

/* ── Multi-pick + create-new picker for the task panel ── */

export function TagPicker({
  selected, onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const tags = useTags();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const matchSet = useMemo(() => new Set(selected), [selected]);
  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tags
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .sort((a, b) => {
        // Selected tags first, then alphabetic
        const sa = matchSet.has(a.id) ? 0 : 1;
        const sb = matchSet.has(b.id) ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return a.name.localeCompare(b.name);
      });
  }, [tags, query, matchSet]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return tags.find((t) => t.name.toLowerCase() === q) ?? null;
  }, [tags, query]);

  const toggle = useCallback(
    (id: string) => {
      onChange(matchSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    },
    [matchSet, onChange, selected],
  );

  async function createAndSelect() {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const t = (await res.json()) as Tag;
        await refreshTags();
        if (!matchSet.has(t.id)) onChange([...selected, t.id]);
        setQuery("");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && query.trim() && !exactMatch) {
            e.preventDefault();
            createAndSelect();
          }
        }}
        placeholder="Search or type a new tag…"
        style={inputStyle}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {sorted.length === 0 && !query.trim() && (
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
            No tags yet — type a name and press Enter to create one.
          </span>
        )}
        {sorted.map((t) => {
          const active = matchSet.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 10px", borderRadius: 999,
                border: `1px solid ${active ? t.color : "var(--color-border)"}`,
                background: active ? tint(t.color, 0.15) : "transparent",
                color: active ? t.color : "var(--color-text-primary)",
                fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.color }} />
              {t.name}
              {active && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <polyline points="4,12 9,17 20,6" />
                </svg>
              )}
            </button>
          );
        })}
        {query.trim() && !exactMatch && (
          <button
            type="button"
            onClick={createAndSelect}
            disabled={creating}
            style={{
              ...primaryButtonStyle,
              padding: "5px 12px",
              fontSize: 12,
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? "Creating…" : `+ Create "${query.trim()}"`}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Filter chips row — used at top of any task list view ── */

export function TagFilterChips({
  allTagIds,
  active,
  onChange,
}: {
  /** All tag IDs that appear on any task currently in scope (so we don't show empties). */
  allTagIds: Set<string>;
  active: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const tags = useTags();
  const visible = tags.filter((t) => allTagIds.has(t.id));
  if (visible.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {visible.map((t) => {
        const isActive = active.has(t.id);
        return (
          <button
            key={t.id}
            onClick={() => {
              const next = new Set(active);
              if (isActive) next.delete(t.id);
              else next.add(t.id);
              onChange(next);
            }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 10px", borderRadius: 999,
              border: `1px solid ${isActive ? t.color : "var(--color-border)"}`,
              background: isActive ? tint(t.color, 0.15) : "transparent",
              color: isActive ? t.color : "var(--color-text-secondary)",
              fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.color }} />
            {t.name}
          </button>
        );
      })}
      {active.size > 0 && (
        <button
          onClick={() => onChange(new Set())}
          style={{
            padding: "5px 10px", borderRadius: 999,
            background: "transparent", border: "1px dashed var(--color-border)",
            color: "var(--color-text-tertiary)", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Clear tags
        </button>
      )}
    </div>
  );
}

void readableOn; // exported below if needed
export { readableOn };
