"use client";

import { useEffect, useRef, useState } from "react";

/** Inline-editable task title. Double-click to edit, Enter or blur to save,
 *  Escape to cancel. Renders a <span> by default so it can be dropped into
 *  any row layout that already styles a title span.
 *
 *  Pass `onSingleClick` to take over the parent row's click-to-open behavior:
 *  the title swallows clicks (so the row's own onClick doesn't fire) and runs
 *  `onSingleClick` after a short delay, cancelling it if a second click comes
 *  in within the double-click window. Without this, the row's onClick would
 *  toggle the side panel between the two halves of a double-click and the
 *  edit mode would never settle.
 */
export function InlineTaskTitle({
  title,
  completed,
  onSave,
  onSingleClick,
  style,
  fontSize = 14,
}: {
  title: string;
  completed?: boolean;
  onSave: (next: string) => Promise<void> | void;
  onSingleClick?: () => void;
  style?: React.CSSProperties;
  fontSize?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const clickTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
  }, []);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function commit() {
    const v = draft.trim();
    if (!v || v === title) {
      setDraft(title);
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onSave(v);
      setEditing(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Rename failed");
      setDraft(title);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(title);
            setEditing(false);
          }
        }}
        onBlur={() => void commit()}
        style={{
          flex: 1, minWidth: 0,
          fontSize, fontFamily: "inherit", fontWeight: 500,
          padding: "2px 6px",
          border: "1px solid var(--color-accent)",
          borderRadius: 6,
          background: "white",
          color: "var(--color-text-primary)",
          outline: "none",
          ...style,
        }}
      />
    );
  }

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        if (!onSingleClick) return;
        if (e.detail >= 2) {
          if (clickTimerRef.current) {
            window.clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
          }
          return;
        }
        if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = window.setTimeout(() => {
          clickTimerRef.current = null;
          onSingleClick();
        }, 220);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (clickTimerRef.current) {
          window.clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null;
        }
        setEditing(true);
      }}
      style={{
        flex: 1, minWidth: 0,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        fontSize,
        color: completed ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
        textDecoration: completed ? "line-through" : "none",
        cursor: "text",
        ...style,
      }}
    >
      {title}
    </span>
  );
}
