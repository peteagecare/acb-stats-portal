"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

interface Notification {
  id: string;
  recipientEmail: string;
  kind: string;
  noteId: string | null;
  taskId: string | null;
  actorEmail: string;
  payload: {
    noteTitle?: string;
    actorLabel?: string;
    excerpt?: string | null;
    taskTitle?: string;
    projectId?: string;
    projectName?: string;
    companyId?: string;
    companyName?: string;
    itemTitle?: string;
    itemKind?: string;
    itemUrl?: string;
    newStatus?: string;
    rejectionNote?: string | null;
    summary?: string;
    parentTitle?: string;
    parentUrl?: string;
  } | null;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

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

  // Close on outside click + reposition on resize/scroll while open
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function reposition() {
      if (buttonRef.current) setAnchor(buttonRef.current.getBoundingClientRect());
    }
    document.addEventListener("mousedown", onClick);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    refresh();
  }

  async function clearAll() {
    if (notifs.length === 0) return;
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archiveIds: notifs.map((n) => n.id) }),
    });
    refresh();
  }

  async function clearOne(id: string) {
    // Optimistic — drop the row immediately, then sync.
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archiveIds: [id] }),
    });
    refresh();
  }

  function togglePanel() {
    setOpen((v) => {
      const next = !v;
      if (next) {
        if (buttonRef.current) setAnchor(buttonRef.current.getBoundingClientRect());
        if (unread > 0) markAllRead();
      }
      return next;
    });
  }

  return (
    <>
      <button
        ref={buttonRef}
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
            border: "2px solid white",
          }}>{unread > 99 ? "99+" : unread}</span>
        )}
      </button>

      {mounted && open && anchor && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: anchor.bottom + 6,
            left: clampLeft(anchor.left, 360),
            zIndex: 1000,
            width: 360,
            maxHeight: "min(70vh, 520px)",
            background: "white", borderRadius: 12,
            boxShadow: "0 10px 32px rgba(0,0,0,0.18)",
            border: "1px solid var(--color-border)",
            overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-border)",
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Notifications</div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {notifs.length > 0 && (
                <button
                  onClick={clearAll}
                  style={{
                    background: "transparent", border: "none",
                    color: "var(--color-accent)", cursor: "pointer",
                    fontSize: 11, fontWeight: 600, padding: "2px 6px",
                    borderRadius: 6, fontFamily: "inherit",
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {notifs.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 12, color: "var(--color-text-tertiary)" }}>
                Nothing here — you&rsquo;re all caught up.
              </div>
            ) : (
              notifs.map((n) => (
                <NotifRow
                  key={n.id}
                  n={n}
                  onClose={() => setOpen(false)}
                  onClear={() => clearOne(n.id)}
                />
              ))
            )}
          </div>
          <div style={{
            padding: "8px 14px",
            borderTop: "1px solid var(--color-border)",
            flexShrink: 0,
            textAlign: "center",
          }}>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              style={{
                fontSize: 12, color: "var(--color-accent)",
                textDecoration: "none", fontWeight: 600,
              }}
            >
              View all notifications →
            </Link>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function clampLeft(x: number, width: number): number {
  if (typeof window === "undefined") return x;
  const margin = 8;
  return Math.max(margin, Math.min(x, window.innerWidth - width - margin));
}

function NotifRow({ n, onClose, onClear }: { n: Notification; onClose: () => void; onClear?: () => void }) {
  const actor = n.payload?.actorLabel ?? n.actorEmail;
  const excerpt = n.payload?.excerpt ?? null;

  let text: string;
  let href: string | null = null;
  if (n.kind === "workspace_task_assigned") {
    const taskTitle = n.payload?.taskTitle ?? "a task";
    const projectName = n.payload?.projectName;
    text = projectName
      ? `${actor} assigned you "${taskTitle}" in ${projectName}`
      : `${actor} assigned you "${taskTitle}"`;
    if (n.payload?.companyId && n.payload?.projectId && n.taskId) {
      href = `/workspace/${n.payload.companyId}/${n.payload.projectId}?task=${n.taskId}`;
    }
  } else if (n.kind === "workspace_task_completed") {
    const taskTitle = n.payload?.taskTitle ?? "a task";
    text = `${actor} completed "${taskTitle}"`;
    if (n.payload?.companyId && n.payload?.projectId && n.taskId) {
      href = `/workspace/${n.payload.companyId}/${n.payload.projectId}?task=${n.taskId}`;
    }
  } else if (n.kind === "task_assigned") {
    const noteTitle = n.payload?.noteTitle ?? "a meeting note";
    text = `${actor} assigned you a task in "${noteTitle}"`;
    if (n.noteId) href = `/notes?id=${n.noteId}&mention=${encodeURIComponent(n.recipientEmail)}`;
  } else if (n.kind === "finance_approval_step") {
    const itemTitle = n.payload?.itemTitle ?? "an item";
    text = `${actor} approved "${itemTitle}" — your turn`;
    href = (n.payload?.itemUrl as string | undefined) ?? "/financial-approvals";
  } else if (n.kind === "finance_approval_rejected") {
    const itemTitle = n.payload?.itemTitle ?? "an item";
    text = `${actor} sent "${itemTitle}" back for changes`;
    href = (n.payload?.itemUrl as string | undefined) ?? "/financial-approvals";
  } else if (n.kind === "comment_added") {
    const parentTitle = (n.payload?.parentTitle as string | undefined) ?? "an item";
    text = `${actor} commented on "${parentTitle}"`;
    href = (n.payload?.parentUrl as string | undefined) ?? null;
  } else if (n.kind === "comment_mention") {
    const parentTitle = (n.payload?.parentTitle as string | undefined) ?? "an item";
    text = `${actor} mentioned you in a comment on "${parentTitle}"`;
    href = (n.payload?.parentUrl as string | undefined) ?? null;
  } else if (n.kind === "note_shared") {
    const noteTitle = (n.payload?.noteTitle as string | undefined) ?? "a meeting note";
    text = `${actor} shared "${noteTitle}" with you`;
    if (n.noteId) href = `/notes?id=${n.noteId}`;
  } else if (n.kind === "review_received") {
    const platform = (n.payload?.itemKind as string | undefined) ?? "a platform";
    const delta = (n.payload?.summary as string | undefined) ?? "";
    text = `${platform} review activity${delta ? ` — ${delta}` : ""}`;
    href = "/reviews-social";
  } else if (n.kind === "calendar_status") {
    const itemTitle = n.payload?.itemTitle ?? "a content piece";
    const newStatus = n.payload?.newStatus ?? "updated";
    text = `${actor} moved "${itemTitle}" to ${newStatus}`;
    href = (n.payload?.itemUrl as string | undefined) ?? "/content-calendar";
  } else {
    const noteTitle = n.payload?.noteTitle ?? "a meeting note";
    text = `${actor} mentioned you in "${noteTitle}"`;
    if (n.noteId) href = `/notes?id=${n.noteId}&mention=${encodeURIComponent(n.recipientEmail)}`;
  }

  const body = (
    <div style={{
      display: "flex", gap: 10,
      padding: "10px 14px",
      background: n.readAt === null ? "rgba(0,113,227,0.05)" : "transparent",
    }}>
      <span style={{
        flexShrink: 0, marginTop: 5,
        width: 8, height: 8, borderRadius: "50%",
        background: n.readAt === null ? "var(--color-accent)" : "transparent",
      }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.4 }}>
          {text}
        </span>
        {excerpt && (
          <span style={{
            fontSize: 12, color: "var(--color-text-secondary)",
            marginTop: 4, padding: "6px 8px",
            background: "rgba(0,0,0,0.04)", borderRadius: 6,
            borderLeft: "2px solid var(--color-accent)",
            lineHeight: 1.4,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {excerpt}
          </span>
        )}
        <span style={{ display: "block", fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 4 }}>
          {formatTime(n.createdAt)}
        </span>
      </span>
    </div>
  );

  const wrapped = href
    ? (
      <Link href={href} onClick={onClose} style={{ textDecoration: "none", color: "inherit", display: "block", flex: 1, minWidth: 0 }}>
        {body}
      </Link>
    )
    : <div style={{ flex: 1, minWidth: 0 }}>{body}</div>;

  return (
    <div style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid var(--color-border)" }}>
      {wrapped}
      {onClear && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear(); }}
          aria-label="Clear notification"
          title="Clear"
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--color-text-tertiary)", padding: "10px 12px",
            display: "flex", alignItems: "center", flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
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
