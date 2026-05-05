"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CALENDAR_ASSET_TYPES,
  CALENDAR_PLATFORMS,
  CALENDAR_STATUSES,
  STATUS_COLOURS,
  type CalendarEntry,
  type CalendarAssetType,
  type CalendarPlatform,
  type CalendarStatus,
} from "@/lib/content-calendar";
import { RichNoteEditor } from "../../_note-editor";

export default function EntryNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [entry, setEntry] = useState<CalendarEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/content-calendar")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: CalendarEntry[] }) => {
        if (cancelled) return;
        setEntry(d.items?.find((i) => i.id === id) ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  function patch(patchBody: Partial<CalendarEntry>) {
    setEntry((prev) => (prev ? { ...prev, ...patchBody } : prev));
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await fetch("/api/content-calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patchBody }),
      }).catch(() => null);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1200);
    }, 600);
  }

  if (loading) {
    return (
      <div style={{ padding: 28 }}>
        <p style={{ color: "var(--color-text-tertiary)" }}>Loading…</p>
      </div>
    );
  }
  if (!entry) {
    return (
      <div style={{ padding: 28 }}>
        <Link href="/content-calendar" style={{ color: "var(--color-accent)", fontSize: 13 }}>← Back to Content Calendar</Link>
        <h1 style={{ marginTop: 16 }}>Entry not found</h1>
      </div>
    );
  }

  const statusColour = STATUS_COLOURS[entry.status];

  return (
    <div style={{ padding: "20px 28px 60px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <Link
          href="/content-calendar"
          style={{ color: "var(--color-accent)", fontSize: 13, textDecoration: "none" }}
        >
          ← Back to Content Calendar
        </Link>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Auto-saves"}
        </span>
      </div>

      <input
        value={entry.title}
        onChange={(e) => patch({ title: e.target.value })}
        placeholder="Untitled"
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
        aria-label="Title"
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <MetaChip label="Date">
          <input
            type="date"
            value={entry.liveDate}
            onChange={(e) => patch({ liveDate: e.target.value })}
            style={inlineInputStyle}
          />
        </MetaChip>
        <MetaChip label="Time">
          <input
            type="time"
            value={entry.time ?? ""}
            onChange={(e) => patch({ time: e.target.value || undefined })}
            style={inlineInputStyle}
          />
        </MetaChip>
        <MetaChip label="Platform">
          <select
            value={entry.platform}
            onChange={(e) => patch({ platform: e.target.value as CalendarPlatform })}
            style={inlineInputStyle}
          >
            {CALENDAR_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </MetaChip>
        <MetaChip label="Asset">
          <select
            value={entry.assetType ?? ""}
            onChange={(e) => patch({ assetType: (e.target.value || undefined) as CalendarAssetType | undefined })}
            style={inlineInputStyle}
          >
            <option value="">—</option>
            {CALENDAR_ASSET_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </MetaChip>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            background: statusColour.bg,
            color: statusColour.fg,
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <select
            value={entry.status}
            onChange={(e) => patch({ status: e.target.value as CalendarStatus })}
            style={{
              background: "transparent",
              border: "none",
              color: statusColour.fg,
              fontWeight: 700,
              fontSize: 11,
              fontFamily: "inherit",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {CALENDAR_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </span>
        <MetaChip label="Responsible">
          <input
            value={entry.responsible ?? ""}
            onChange={(e) => patch({ responsible: e.target.value || undefined })}
            placeholder="—"
            style={{ ...inlineInputStyle, width: 100 }}
          />
        </MetaChip>
      </div>

      <textarea
        value={entry.notes ?? ""}
        onChange={(e) => patch({ notes: e.target.value })}
        placeholder="Short summary / brief…"
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
        content={entry.content ?? ""}
        placeholder="Long-form planning notes for this content piece…"
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

const inlineInputStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--color-text-primary)",
  fontFamily: "inherit",
  cursor: "pointer",
  outline: "none",
  padding: 0,
};
