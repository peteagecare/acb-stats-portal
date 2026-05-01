"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Notification {
  id: string;
  recipientEmail: string;
  kind: string;
  noteId: string | null;
  taskId: string | null;
  actorEmail: string;
  payload: { noteTitle?: string; actorLabel?: string } | null;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json()) as { notifications: Notification[]; unreadCount: number };
      setNotifs(j.notifications);
      setUnread(j.unreadCount);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    refresh();
  }

  function togglePanel() {
    setOpen((v) => {
      const next = !v;
      if (next && unread > 0) {
        // Mark read in the background when opening
        markAllRead();
      }
      return next;
    });
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={togglePanel}
        aria-label="Notifications"
        style={{
          position: "relative",
          width: 32, height: 32, borderRadius: 9,
          background: "transparent", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--color-text-secondary)",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.05)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 4, right: 4,
            minWidth: 16, height: 16, padding: "0 4px",
            borderRadius: 999,
            background: "#EF4444", color: "white",
            fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid var(--bg-card, white)",
          }}>{unread > 99 ? "99+" : unread}</span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 40,
            width: 340,
            background: "white", borderRadius: 12,
            boxShadow: "0 10px 32px rgba(0,0,0,0.16)",
            border: "1px solid var(--color-border)",
            overflow: "hidden",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center",
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-border)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Notifications</div>
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {notifs.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 12, color: "var(--color-text-tertiary)" }}>
                Nothing yet.
              </div>
            ) : (
              notifs.map((n) => <NotifRow key={n.id} n={n} onClose={() => setOpen(false)} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifRow({ n, onClose }: { n: Notification; onClose: () => void }) {
  const isAssign = n.kind === "task_assigned";
  const actor = n.payload?.actorLabel ?? n.actorEmail;
  const noteTitle = n.payload?.noteTitle ?? "a meeting note";
  const text = isAssign
    ? `${actor} assigned you a task in "${noteTitle}"`
    : `${actor} mentioned you in "${noteTitle}"`;

  const inner = (
    <div style={{
      display: "flex", gap: 10,
      padding: "10px 14px",
      background: n.readAt === null ? "rgba(0,113,227,0.05)" : "transparent",
      borderBottom: "1px solid var(--color-border)",
    }}>
      <span style={{
        flexShrink: 0, marginTop: 3,
        width: 8, height: 8, borderRadius: "50%",
        background: n.readAt === null ? "var(--color-accent)" : "transparent",
      }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.4 }}>
          {text}
        </span>
        <span style={{ display: "block", fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>
          {formatTime(n.createdAt)}
        </span>
      </span>
    </div>
  );

  if (n.noteId) {
    return (
      <Link href={`/notes`} onClick={onClose} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {inner}
      </Link>
    );
  }
  return inner;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}
