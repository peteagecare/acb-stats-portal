"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
    summary?: string;
    parentTitle?: string;
    parentUrl?: string;
  } | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
}

type Filter = "all" | "unread" | "archived";

export default function NotificationsHistoryPage() {
  const [notifs, setNotifs] = useState<Notification[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/notifications?include=all", { cache: "no-store" });
    if (!res.ok) return;
    const j = (await res.json()) as { notifications: Notification[] };
    setNotifs(j.notifications);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const counts = useMemo(() => {
    if (!notifs) return { all: 0, unread: 0, archived: 0 };
    let all = 0, unread = 0, archived = 0;
    for (const n of notifs) {
      if (n.archivedAt) archived++;
      else {
        all++;
        if (!n.readAt) unread++;
      }
    }
    return { all, unread, archived };
  }, [notifs]);

  const filtered = useMemo(() => {
    if (!notifs) return null;
    if (filter === "archived") return notifs.filter((n) => n.archivedAt);
    if (filter === "unread") return notifs.filter((n) => !n.archivedAt && !n.readAt);
    return notifs.filter((n) => !n.archivedAt);
  }, [notifs, filter]);

  async function archiveIds(ids: string[]) {
    if (ids.length === 0) return;
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archiveIds: ids }),
    });
    if (res.ok) refresh();
  }
  async function restoreIds(ids: string[]) {
    if (ids.length === 0) return;
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restoreIds: ids }),
    });
    if (res.ok) refresh();
  }
  async function deleteOne(id: string) {
    const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    if (res.ok) refresh();
  }
  async function archiveAllRead() {
    if (!confirm("Archive every read notification?")) return;
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archiveAllRead: true }),
    });
    if (res.ok) refresh();
  }
  async function deleteAllArchived() {
    if (!notifs) return;
    const archivedCount = notifs.filter((n) => n.archivedAt).length;
    if (archivedCount === 0) return;
    if (!confirm(`Permanently delete all ${archivedCount} archived notifications? This cannot be undone.`)) return;
    const res = await fetch("/api/notifications?all=archived", { method: "DELETE" });
    if (res.ok) refresh();
  }

  return (
    <div style={{ padding: "28px 28px 60px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
          Notifications
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
          Your full history. Archived notifications are kept here so you can find them again.
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <FilterPill label={`All (${counts.all})`} active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterPill label={`Unread (${counts.unread})`} active={filter === "unread"} onClick={() => setFilter("unread")} />
        <FilterPill label={`Archived (${counts.archived})`} active={filter === "archived"} onClick={() => setFilter("archived")} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {filter !== "archived" && filtered && filtered.some((n) => n.readAt) && (
            <BulkButton onClick={archiveAllRead}>Archive all read</BulkButton>
          )}
          {filter !== "archived" && filtered && filtered.length > 0 && (
            <BulkButton onClick={() => archiveIds(filtered.map((n) => n.id))}>Clear all</BulkButton>
          )}
          {filter === "archived" && counts.archived > 0 && (
            <>
              <BulkButton onClick={() => restoreIds(notifs!.filter((n) => n.archivedAt).map((n) => n.id))}>
                Restore all
              </BulkButton>
              <BulkButton onClick={deleteAllArchived} danger>Delete all</BulkButton>
            </>
          )}
        </div>
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
            {filter === "archived" ? "Nothing archived yet." : filter === "unread" ? "No unread notifications." : "Nothing here yet."}
          </div>
        )}
        {filtered && filtered.map((n) => (
          <HistoryRow
            key={n.id}
            n={n}
            onArchive={() => archiveIds([n.id])}
            onRestore={() => restoreIds([n.id])}
            onDelete={() => {
              if (!confirm("Permanently delete this notification?")) return;
              deleteOne(n.id);
            }}
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

function BulkButton({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: `1px solid ${danger ? "#FCA5A5" : "var(--color-border)"}`,
        padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
        color: danger ? "#B91C1C" : "var(--color-text-secondary)",
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function HistoryRow({
  n, onArchive, onRestore, onDelete,
}: {
  n: Notification;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const isArchived = !!n.archivedAt;
  const { text, href } = describeNotification(n);

  const inner = (
    <div style={{
      display: "flex", gap: 10,
      padding: "12px 16px",
      opacity: isArchived ? 0.6 : 1,
    }}>
      <span style={{
        flexShrink: 0, marginTop: 5,
        width: 8, height: 8, borderRadius: "50%",
        background: !n.readAt && !isArchived ? "var(--color-accent)" : "transparent",
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
          {isArchived && " · archived"}
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
      {isArchived ? (
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <RowAction label="Restore" onClick={onRestore} />
          <RowAction label="Delete" onClick={onDelete} danger />
        </div>
      ) : (
        <RowAction
          label=""
          ariaLabel="Archive notification"
          title="Archive"
          onClick={onArchive}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          }
        />
      )}
    </div>
  );
}

function RowAction({
  label, onClick, danger, icon, ariaLabel, title,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
  ariaLabel?: string;
  title?: string;
}) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      title={title ?? label}
      aria-label={ariaLabel ?? label}
      style={{
        background: "transparent", border: "none", cursor: "pointer",
        color: danger ? "#B91C1C" : "var(--color-text-tertiary)",
        padding: "0 14px",
        display: "flex", alignItems: "center", flexShrink: 0,
        fontSize: 11, fontWeight: 600, fontFamily: "inherit",
      }}
    >
      {icon ?? label}
    </button>
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
