"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CALENDAR_PLATFORMS, type CalendarPlatform } from "@/lib/content-calendar";
import { RichNoteEditor } from "../../_note-editor";

interface ContentIdea {
  id: string;
  title: string;
  notes?: string;
  platform?: CalendarPlatform;
  content?: string;
  createdAt: string;
  createdBy: string;
}

export default function IdeaNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [idea, setIdea] = useState<ContentIdea | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/content-ideas")
      .then((r) => (r.ok ? r.json() : { ideas: [] }))
      .then((d: { ideas?: ContentIdea[] }) => {
        if (cancelled) return;
        setIdea(d.ideas?.find((i) => i.id === id) ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  function patch(patchBody: Partial<ContentIdea>) {
    setIdea((prev) => (prev ? { ...prev, ...patchBody } : prev));
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await fetch("/api/content-ideas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patchBody }),
      }).catch(() => null);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1200);
    }, 600);
  }

  const headerLabel = useMemo(() => idea?.title ?? "Loading…", [idea]);

  if (loading) {
    return (
      <div style={{ padding: 28 }}>
        <p style={{ color: "var(--color-text-tertiary)" }}>Loading…</p>
      </div>
    );
  }
  if (!idea) {
    return (
      <div style={{ padding: 28 }}>
        <Link href="/content-calendar" style={{ color: "var(--color-accent)", fontSize: 13 }}>← Back to Content Calendar</Link>
        <h1 style={{ marginTop: 16 }}>Idea not found</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 28px 60px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <Link
          href="/content-calendar?openIdeas=1"
          style={{ color: "var(--color-accent)", fontSize: 13, textDecoration: "none" }}
        >
          ← Back to Idea Library
        </Link>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Auto-saves"}
        </span>
      </div>

      <input
        value={idea.title}
        onChange={(e) => patch({ title: e.target.value })}
        placeholder="Untitled idea"
        style={{
          width: "100%",
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          border: "none",
          outline: "none",
          background: "transparent",
          marginBottom: 12,
          color: "var(--color-text-primary)",
          fontFamily: "inherit",
        }}
        aria-label="Idea title"
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <MetaChip label="Platform">
          <select
            value={idea.platform ?? ""}
            onChange={(e) => patch({ platform: (e.target.value || undefined) as CalendarPlatform | undefined })}
            style={inlineSelectStyle}
          >
            <option value="">Any platform</option>
            {CALENDAR_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </MetaChip>
      </div>

      <textarea
        value={idea.notes ?? ""}
        onChange={(e) => patch({ notes: e.target.value })}
        placeholder="Short summary (optional)…"
        rows={2}
        style={{
          width: "100%",
          padding: "8px 10px",
          fontSize: 13,
          color: "var(--color-text-secondary)",
          background: "rgba(0,0,0,0.02)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          outline: "none",
          fontFamily: "inherit",
          marginBottom: 18,
          resize: "vertical",
        }}
        aria-label="Short summary"
      />

      <RichNoteEditor
        content={idea.content ?? ""}
        placeholder={`Plan out "${headerLabel}"…`}
        onChange={(html) => patch({ content: html })}
      />
    </div>
  );
}

function MetaChip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        background: "rgba(0,0,0,0.04)",
        borderRadius: 8,
        fontSize: 11,
        color: "var(--color-text-secondary)",
      }}
    >
      <span style={{ fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </span>
      {children}
    </span>
  );
}

const inlineSelectStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--color-text-primary)",
  fontFamily: "inherit",
  cursor: "pointer",
  outline: "none",
};
