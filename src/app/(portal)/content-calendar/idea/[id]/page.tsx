"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CalendarPlatform } from "@/lib/content-calendar";
import { PlatformPills } from "../../_platform-pills";
import { RichNoteEditor } from "../../_note-editor";

interface ContentIdea {
  id: string;
  title: string;
  notes?: string;
  platforms?: CalendarPlatform[];
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
  const pendingPatch = useRef<Partial<ContentIdea>>({});

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
    pendingPatch.current = { ...pendingPatch.current, ...patchBody };
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const body = pendingPatch.current;
      pendingPatch.current = {};
      await fetch("/api/content-ideas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
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

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
          Preferred platforms
        </div>
        <PlatformPills
          value={idea.platforms ?? []}
          onChange={(next) => patch({ platforms: next.length ? next : undefined })}
          ariaLabel="Preferred platforms for this idea"
        />
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

