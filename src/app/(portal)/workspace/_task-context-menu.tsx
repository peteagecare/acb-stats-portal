"use client";

import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { RecurrenceRule, formatISODate, formatRecurrence, nextOccurrence } from "@/lib/recurrence";
import { RecurrencePicker } from "./_recurrence-picker";
import { MoveToPanel } from "./_move-to-panel";
import { inputStyle } from "./_shared";

interface MenuPos {
  x: number;
  y: number;
}

type View = "root" | "dates" | "repeat" | "move";

type TaskPatch = {
  startDate?: string | null;
  endDate?: string | null;
  recurrence?: RecurrenceRule | null;
  projectId?: string;
  sectionId?: string | null;
};

/** Right-click context menu for tasks. Returns an `onContextMenu` handler to
 *  spread on the task element, and a `menu` node to render somewhere stable
 *  in the tree. The menu is portaled to <body> so it's never clipped by
 *  scrollable parents.
 *
 *  Inline submenus let you set start/end dates and a recurrence rule without
 *  leaving the popover — no side panel or tab opens.
 */
export function useTaskContextMenu({
  taskTitle,
  currentStartDate,
  currentEndDate,
  currentRecurrence,
  currentProjectId,
  currentSectionId,
  onDelete,
  onUpdate,
}: {
  taskTitle?: string;
  currentStartDate?: string | null;
  currentEndDate?: string | null;
  currentRecurrence?: RecurrenceRule | null;
  currentProjectId?: string;
  currentSectionId?: string | null;
  onDelete: () => Promise<void> | void;
  onUpdate?: (patch: TaskPatch) => Promise<void> | void;
}) {
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [view, setView] = useState<View>("root");
  const [busy, setBusy] = useState(false);

  function onContextMenu(e: ReactMouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setView("root");
    setPos({ x: e.clientX, y: e.clientY });
  }

  function close() {
    setPos(null);
    setView("root");
  }

  async function handleDelete() {
    const label = taskTitle ? `"${taskTitle}"` : "this task";
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await onDelete();
      close();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function applyPatch(patch: TaskPatch) {
    if (!onUpdate) return;
    setBusy(true);
    try {
      await onUpdate(patch);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const menu = pos ? (
    <ContextMenuPopover pos={pos} onClose={close} wide={view !== "root"} tall={view === "move"}>
      {view === "root" && (
        <>
          {onUpdate && (
            <>
              <MenuItem
                label="Set dates…"
                onClick={() => setView("dates")}
              />
              <MenuItem
                label={
                  currentRecurrence
                    ? `Repeat: ${formatRecurrence(currentRecurrence)}`
                    : "Set repeat…"
                }
                onClick={() => setView("repeat")}
              />
              {currentProjectId && (
                <MenuItem
                  label="Move to…"
                  onClick={() => setView("move")}
                />
              )}
              <MenuDivider />
            </>
          )}
          <MenuItem
            label={busy ? "Deleting…" : "Delete"}
            danger
            disabled={busy}
            onClick={handleDelete}
          />
        </>
      )}

      {view === "dates" && (
        <DatesPanel
          startDate={currentStartDate ?? null}
          endDate={currentEndDate ?? null}
          busy={busy}
          onBack={() => setView("root")}
          onSave={async (start, end) => {
            await applyPatch({ startDate: start, endDate: end });
            close();
          }}
        />
      )}

      {view === "repeat" && (
        <RepeatPanel
          value={currentRecurrence ?? null}
          busy={busy}
          onBack={() => setView("root")}
          onSave={async (rule) => {
            // Whenever a rule is saved, re-seed the due date with the next
            // occurrence so changing the days updates the deadline.
            const patch: TaskPatch = { recurrence: rule };
            if (rule) {
              const seed = nextOccurrence(rule, new Date());
              if (seed) patch.endDate = formatISODate(seed);
            }
            await applyPatch(patch);
            close();
          }}
        />
      )}

      {view === "move" && currentProjectId && (
        <div style={{ padding: 4 }}>
          <PanelHeader title="Move to" onBack={() => setView("root")} />
          <MoveToPanel
            currentProjectId={currentProjectId}
            currentSectionId={currentSectionId ?? null}
            onMove={async (projectId, sectionId) => {
              const patch: TaskPatch = { sectionId };
              if (projectId !== currentProjectId) patch.projectId = projectId;
              await applyPatch(patch);
            }}
            onClose={close}
          />
        </div>
      )}
    </ContextMenuPopover>
  ) : null;

  return { onContextMenu, menu };
}

function ContextMenuPopover({
  pos, onClose, children, wide, tall,
}: {
  pos: MenuPos;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  tall?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close on outside click or Escape. Don't close on scroll/resize while a
  // submenu is open — losing your half-typed date because the page reflowed
  // is annoying.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = e.target as HTMLElement;
      if (el.closest?.("[data-task-context-menu]")) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted || typeof document === "undefined") return null;

  const W = wide ? 300 : 220;
  const H = tall ? 480 : wide ? 380 : 240;
  const margin = 6;
  const left = Math.min(pos.x, (typeof window !== "undefined" ? window.innerWidth : W) - W - margin);
  const top = Math.min(pos.y, (typeof window !== "undefined" ? window.innerHeight : H) - H - margin);

  return createPortal(
    <div
      data-task-context-menu
      style={{
        position: "fixed",
        top, left,
        zIndex: 1000,
        minWidth: wide ? 280 : 180,
        maxWidth: wide ? 320 : 220,
        background: "white",
        borderRadius: 10,
        boxShadow: "0 10px 28px rgba(0,0,0,0.16)",
        border: "1px solid var(--color-border)",
        padding: 4,
        fontSize: 13,
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  );
}

function MenuItem({
  label, onClick, danger, disabled,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: "100%", padding: "8px 10px", borderRadius: 6,
        background: "transparent", border: "none",
        color: danger ? "#B91C1C" : "var(--color-text-primary)",
        fontSize: 13, fontWeight: 500, fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left", opacity: disabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = danger ? "rgba(185,28,28,0.08)" : "rgba(0,0,0,0.05)";
      }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {label}
    </button>
  );
}

function MenuDivider() {
  return <div style={{ height: 1, background: "var(--color-border)", margin: "4px 6px" }} />;
}

function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "6px 4px 8px", borderBottom: "1px solid var(--color-border)",
      marginBottom: 8,
    }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          padding: "2px 6px", borderRadius: 4, fontSize: 13, fontFamily: "inherit",
          color: "var(--color-text-secondary)",
        }}
        aria-label="Back"
      >
        ←
      </button>
      <span style={{ fontWeight: 600, fontSize: 12, color: "var(--color-text-primary)" }}>
        {title}
      </span>
    </div>
  );
}

function DatesPanel({
  startDate, endDate, busy, onBack, onSave,
}: {
  startDate: string | null;
  endDate: string | null;
  busy: boolean;
  onBack: () => void;
  onSave: (start: string | null, end: string | null) => void;
}) {
  const [start, setStart] = useState<string>(startDate ?? "");
  const [end, setEnd] = useState<string>(endDate ?? "");

  return (
    <div style={{ padding: 4 }}>
      <PanelHeader title="Dates" onBack={onBack} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={labelStyle}>
          <span>Start date</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          <span>End date</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            style={inputStyle}
          />
        </label>

        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(start || null, end || null)}
            style={primaryBtnStyle(busy)}
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(null, null)}
            style={secondaryBtnStyle(busy)}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

function RepeatPanel({
  value, busy, onBack, onSave,
}: {
  value: RecurrenceRule | null;
  busy: boolean;
  onBack: () => void;
  onSave: (rule: RecurrenceRule | null) => void;
}) {
  const [draft, setDraft] = useState<RecurrenceRule | null>(value);

  return (
    <div style={{ padding: 4 }}>
      <PanelHeader title="Repeat" onBack={onBack} />
      <RecurrencePicker value={draft} onChange={setDraft} />
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(draft)}
          style={primaryBtnStyle(busy)}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(null)}
          style={secondaryBtnStyle(busy)}
        >
          Don&apos;t repeat
        </button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 4,
  fontSize: 11, color: "var(--color-text-secondary)",
};

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "8px 12px", borderRadius: 8,
    border: "1px solid var(--color-accent)",
    background: "var(--color-accent)",
    color: "white",
    fontSize: 12, fontWeight: 600, fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

function secondaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 12px", borderRadius: 8,
    border: "1px solid var(--color-border)",
    background: "transparent",
    color: "var(--color-text-primary)",
    fontSize: 12, fontWeight: 500, fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}
