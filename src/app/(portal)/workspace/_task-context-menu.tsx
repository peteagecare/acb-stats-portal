"use client";

import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";

interface MenuPos {
  x: number;
  y: number;
}

/** Right-click context menu for tasks. Returns an `onContextMenu` handler to
 *  spread on the task element, and a `menu` node to render somewhere stable
 *  in the tree. The menu is portaled to <body> so it's never clipped by
 *  scrollable parents.
 *
 *  The caller supplies `onDelete` because parents already own the API/refresh
 *  pattern (e.g. project page's `mutateApi`, dashboard's `refresh`). The hook
 *  just owns the menu UI + confirmation step.
 */
export function useTaskContextMenu({
  taskTitle,
  onDelete,
}: {
  taskTitle?: string;
  onDelete: () => Promise<void> | void;
}) {
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [busy, setBusy] = useState(false);

  function onContextMenu(e: ReactMouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPos({ x: e.clientX, y: e.clientY });
  }

  function close() {
    setPos(null);
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

  const menu = pos ? (
    <ContextMenuPopover pos={pos} onClose={close}>
      <MenuItem
        label={busy ? "Deleting…" : "Delete"}
        danger
        disabled={busy}
        onClick={handleDelete}
      />
    </ContextMenuPopover>
  ) : null;

  return { onContextMenu, menu };
}

function ContextMenuPopover({
  pos, onClose, children,
}: {
  pos: MenuPos;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close on outside click, scroll, resize, or Escape
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
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  if (!mounted || typeof document === "undefined") return null;

  // Clamp inside viewport — assume max menu size of 220 × 240
  const W = 220;
  const H = 240;
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
        minWidth: 180,
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
