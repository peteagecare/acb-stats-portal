"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PlatformPills, TypePills } from "./_platform-pills";
import {
  CALENDAR_STATUSES,
  CalendarPlatform,
  CalendarStatus,
  CalendarType,
  STATUS_COLOURS,
} from "@/lib/content-calendar";

const EDIT_HINT_BG = "rgba(15, 23, 42, 0.04)";

/* ---------- Text (single line) ---------- */

export function InlineText({
  value,
  placeholder,
  display,
  trigger = "dblclick",
  onSave,
  inputType = "text",
  inputStyle,
}: {
  value: string;
  placeholder?: string;
  display?: ReactNode;
  trigger?: "click" | "dblclick";
  onSave: (next: string) => void | Promise<void>;
  inputType?: "text" | "time" | "url";
  inputStyle?: CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== value) void onSave(draft);
  }
  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type={inputType}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        style={{
          width: "100%",
          padding: "4px 6px",
          border: "1px solid var(--color-accent, #0071e3)",
          borderRadius: 6,
          fontSize: 12,
          fontFamily: "inherit",
          background: "#fff",
          ...inputStyle,
        }}
      />
    );
  }

  const trigProps =
    trigger === "click"
      ? { onClick: () => setEditing(true) }
      : { onDoubleClick: () => setEditing(true) };

  return (
    <div
      {...trigProps}
      title={trigger === "click" ? "Click to edit" : "Double-click to edit"}
      style={{ cursor: trigger === "click" ? "text" : "pointer", minHeight: 20, padding: "2px 4px", margin: "-2px -4px", borderRadius: 4 }}
      onMouseEnter={(e) => { e.currentTarget.style.background = EDIT_HINT_BG; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {display ?? (value ? <span>{value}</span> : <span style={{ color: "#94a3b8" }}>{placeholder ?? "—"}</span>)}
    </div>
  );
}

/* ---------- Multi-line text ---------- */

export function InlineTextarea({
  value,
  placeholder,
  display,
  onSave,
}: {
  value: string;
  placeholder?: string;
  display?: ReactNode;
  onSave: (next: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== value) void onSave(draft);
  }
  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        rows={3}
        style={{
          width: "100%",
          padding: "4px 6px",
          border: "1px solid var(--color-accent, #0071e3)",
          borderRadius: 6,
          fontSize: 11,
          fontFamily: "inherit",
          background: "#fff",
          resize: "vertical",
        }}
      />
    );
  }

  return (
    <div
      onDoubleClick={() => setEditing(true)}
      title="Double-click to edit (⌘+Enter to save)"
      style={{ cursor: "pointer", minHeight: 20, padding: "2px 4px", margin: "-2px -4px", borderRadius: 4 }}
      onMouseEnter={(e) => { e.currentTarget.style.background = EDIT_HINT_BG; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {display ?? (value ? <span style={{ whiteSpace: "pre-wrap" }}>{value}</span> : <span style={{ color: "#94a3b8" }}>{placeholder ?? "—"}</span>)}
    </div>
  );
}

/* ---------- Status select (double-click → native dropdown) ---------- */

export function InlineStatusSelect({
  value,
  isPete,
  onSave,
}: {
  value: CalendarStatus;
  isPete: boolean;
  onSave: (next: CalendarStatus) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <select
        ref={ref}
        defaultValue={value}
        onChange={(e) => {
          const next = e.target.value as CalendarStatus;
          setEditing(false);
          if (next !== value) void onSave(next);
        }}
        onBlur={() => setEditing(false)}
        style={{
          padding: "3px 6px",
          border: "1px solid var(--color-accent, #0071e3)",
          borderRadius: 6,
          fontSize: 11,
          fontFamily: "inherit",
          background: "#fff",
        }}
      >
        {CALENDAR_STATUSES.map((s) => {
          const restricted = (s === "Approved" || s === "Suggested Changes") && !isPete && value !== s;
          return (
            <option key={s} value={s} disabled={restricted}>
              {s}{restricted ? " (Pete only)" : ""}
            </option>
          );
        })}
      </select>
    );
  }

  const c = STATUS_COLOURS[value];
  return (
    <span
      onDoubleClick={() => setEditing(true)}
      title="Double-click to change status"
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </span>
  );
}

/* ---------- Multi-select popover for platforms / types ---------- */

function Popover({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        marginTop: 4,
        zIndex: 30,
        background: "#fff",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
        padding: 10,
        minWidth: 240,
      }}
    >
      {children}
    </div>
  );
}

export function InlinePlatforms({
  value,
  display,
  onSave,
}: {
  value: CalendarPlatform[];
  display: ReactNode;
  onSave: (next: CalendarPlatform[]) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CalendarPlatform[]>(value);

  useEffect(() => { setDraft(value); }, [value]);

  function commit() {
    setOpen(false);
    const a = draft.slice().sort().join("|");
    const b = value.slice().sort().join("|");
    if (a !== b) void onSave(draft);
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        title="Click to edit platforms"
        style={{ cursor: "pointer", padding: "2px 4px", margin: "-2px -4px", borderRadius: 4 }}
        onMouseEnter={(e) => { e.currentTarget.style.background = EDIT_HINT_BG; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        {display}
      </div>
      {open && (
        <Popover onClose={commit}>
          <PlatformPills value={draft} onChange={setDraft} size="sm" />
        </Popover>
      )}
    </div>
  );
}

export function InlineTypes({
  value,
  display,
  onSave,
}: {
  value: CalendarType[];
  display: ReactNode;
  onSave: (next: CalendarType[]) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CalendarType[]>(value);

  useEffect(() => { setDraft(value); }, [value]);

  function commit() {
    setOpen(false);
    const a = draft.slice().sort().join("|");
    const b = value.slice().sort().join("|");
    if (a !== b) void onSave(draft);
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        onDoubleClick={() => setOpen((o) => !o)}
        title="Double-click to edit types"
        style={{ cursor: "pointer", padding: "2px 4px", margin: "-2px -4px", borderRadius: 4 }}
        onMouseEnter={(e) => { e.currentTarget.style.background = EDIT_HINT_BG; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        {display}
      </div>
      {open && (
        <Popover onClose={commit}>
          <TypePills value={draft} onChange={setDraft} size="sm" />
        </Popover>
      )}
    </div>
  );
}
