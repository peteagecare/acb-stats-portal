"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  clearAll as clearAllDismissals,
  dismiss,
  getDismissed,
  restore,
} from "@/lib/notifications-dismissed";

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
    summary?: string;
    parentTitle?: string;
    parentUrl?: string;
  } | null;
  readAt: string | null;
  createdAt: string;
}

type Filter = "all" | "active" | "dismissed";

export default function NotificationsHistoryPage() {
  const [notifs, setNotifs] = useState<Notification[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [dismissedSet, setDismissedSet] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) return;
    const j = (await res.json()) as { notifications: Notification[] };
    setNotifs(j.notifications);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { email: string | null } | null) => {
        if (j?.email) {
          setMe(j.email);
          setDismissedSet(getDismissed(j.email));
        }
      })
      .catch(() => {});
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!me) return;
    function sync() { setDismissedSet(getDismissed(me)); }
    window.addEventListener("storage", sync);
    window.addEventListener("acb-notifications-dismissed-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("acb-notifications-dismissed-changed", sync);
    };
  }, [me]);

  const filtered = useMemo(() => {
    if (!notifs) return null;
    if (filter === "active") return notifs.filter((n) => !dismissedSet.has(n.id));
    if (filter === "dismissed") return notifs.filter((n) => dismissedSet.has(n.id));
    return notifs;
  }, [notifs, dismissedSet, filter]);

  const counts = useMemo(() => {
    if (!notifs) return { all: 0, active: 0, dismissed: 0 };
    let active = 0, d = 0;
    for (const n of notifs) {
      if (dismissedSet.has(n.id)) d++; else active++;
    }
    return { all: notifs.length, active, dismissed: d };
  }, [notifs, dismissedSet]);

  function handleDismiss(id: string) {
    if (!me) return;
    dismiss(me, id);
  }
  function handleRestore(id: string) {
    if (!me) return;
    restore(me, id);
  }
  function handleRestoreAll() {
    if (!me) return;
    if (!confirm("Restore every dismissed notification?")) return;
    clearAllDismissals(me);
  }

  return (
    <div style={{ padding: "28px 28px 60px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
          Notifications
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
          Your full history. Dismissed notifications stay here so you can find them again.
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <FilterPill label={`All (${counts.all})`} active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterPill label={`Active (${counts.active})`} active={filter === "active"} onClick={() => setFilter("active")} />
        <FilterPill label={`Dismissed (${counts.dismissed})`} active={filter === "dismissed"} onClick={() => setFilter("dismissed")} />
        {counts.dismissed > 0 && (
          <button
            onClick={handleRestoreAll}
            style={{
              marginLeft: "auto",
              background: "transparent", border: "1px solid var(--color-border)",
              padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
              color: "var(--color-text-secondary)", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Restore all dismissed
          </button>
        )}
      </div>

      <div style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
      }}>
        {filtered === null && (
          <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "var(--color-text-tertiary)" }}>
            Loading…
          </div>
        )}
        {filtered && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "var(--color-text-tertiary)" }}>
            {filter === "dismissed" ? "Nothing dismissed yet." : "Nothing here yet."}
          </div>
        )}
        {filtered && filtered.map((n) => (
          <HistoryRow
            key={n.id}
            n={n}
            isDismissed={dismissedSet.has(n.id)}
            onDismiss={() => handleDismiss(n.id)}
            onRestore={() => handleRestore(n.id)}
          />
        ))}
      </div>
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "var(--color-accent)" : "transparent",
        color: active ? "white" : "var(--color-text-secondary)",
        border: active ? "none" : "1px solid var(--color-border)",
        padding: "5px 12px", borderRadius: 999,
        fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

function HistoryRow({
  n, isDismissed, onDismiss, onRestore,
}: {
  n: Notification;
  isDismissed: boolean;
  onDismiss: () => void;
  onRestore: () => void;
}) {
  const { text, href } = describeNotification(n);

  const inner = (
    <div style={{
      display: "flex", gap: 10,
      padding: "12px 16px",
      opacity: isDismissed ? 0.55 : 1,
    }}>
      <span style={{
        flexShrink: 0, marginTop: 5,
        width: 8, height: 8, borderRadius: "50%",
        background: n.readAt === null && !isDismissed ? "var(--color-accent)" : "transparent",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.45 }}>
          {text}
        </div>
        {n.payload?.excerpt && (
          <div style={{
            fontSize: 12, color: "var(--color-text-secondary)",
            marginTop: 6, padding: "6px 10px",
            background: "rgba(0,0,0,0.04)", borderRadius: 6,
            borderLeft: "2px solid var(--color-accent)",
            lineHeight: 1.45,
          }}>
            {n.payload.excerpt}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 6 }}>
          {new Date(n.createdAt).toLocaleString()}
          {isDismissed && " · dismissed"}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      display: "flex", alignItems: "stretch",
      borderBottom: "1px solid var(--color-border)",
    }}>
      {href ? (
        <Link href={href} style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}>
          {inner}
        </Link>
      ) : (
        <div style={{ flex: 1, minWidth: 0 }}>{inner}</div>
      )}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); isDismissed ? onRestore() : onDismiss(); }}
        title={isDismissed ? "Restore" : "Dismiss"}
        aria-label={isDismissed ? "Restore notification" : "Dismiss notification"}
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: "var(--color-text-tertiary)", padding: "0 14px",
          display: "flex", alignItems: "center", flexShrink: 0,
          fontSize: 11, fontWeight: 600,
        }}
      >
        {isDismissed ? "Restore" : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        )}
      </button>
    </div>
  );
}

function describeNotification(n: Notification): { text: string; href: string | null } {
  const actor = n.payload?.actorLabel ?? n.actorEmail;
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

  return { text, href };
}
