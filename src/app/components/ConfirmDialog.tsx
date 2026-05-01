"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && !busy) onConfirm();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel, onConfirm]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 1300,
        background: "rgba(15, 23, 42, 0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        animation: "confirmFadeIn 120ms var(--ease-apple)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          width: "100%", maxWidth: 400,
          padding: "22px 24px 18px",
          animation: "confirmSlideIn 160ms var(--ease-apple)",
        }}
      >
        <h2 style={{
          margin: 0, fontSize: 17, fontWeight: 600,
          color: "var(--color-text-primary)",
        }}>{title}</h2>
        {message && (
          <div style={{
            marginTop: 8,
            fontSize: 13, lineHeight: 1.5,
            color: "var(--color-text-secondary)",
          }}>{message}</div>
        )}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 8,
          marginTop: 20,
        }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: "8px 16px", borderRadius: 10,
              background: "transparent",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
              fontSize: 13, fontWeight: 500,
              cursor: busy ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: busy ? 0.6 : 1,
            }}
          >{cancelLabel}</button>
          <button
            onClick={onConfirm}
            disabled={busy}
            autoFocus
            style={{
              padding: "8px 16px", borderRadius: 10,
              background: destructive ? "#DC2626" : "var(--color-accent)",
              border: "none",
              color: "white",
              fontSize: 13, fontWeight: 600,
              cursor: busy ? "wait" : "pointer",
              fontFamily: "inherit",
              opacity: busy ? 0.7 : 1,
            }}
          >{busy ? "…" : confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
