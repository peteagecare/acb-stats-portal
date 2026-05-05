"use client";

import { useEffect, useState } from "react";

export interface DirectoryUser {
  email: string;
  label: string;
  color: string;
  avatarUrl?: string;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const AVATAR_PALETTE = [
  "#0071E3", "#10B981", "#A855F7", "#F59E0B", "#EC4899",
  "#14B8A6", "#EF4444", "#6366F1", "#84CC16", "#F97316",
];

export function colorForEmail(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function userMeta(email: string | null | undefined, users: DirectoryUser[]): DirectoryUser | null {
  if (!email) return null;
  const found = users.find((u) => u.email === email);
  if (found) return found;
  return {
    email,
    label: email.split("@")[0],
    color: colorForEmail(email),
  };
}

export function useUsers(): DirectoryUser[] {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  useEffect(() => {
    fetch("/api/users", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { users?: { email: string; label: string; avatarUrl?: string }[] } | null) => {
        if (!json?.users) return;
        setUsers(
          json.users.map((u) => ({
            email: u.email,
            label: u.label || u.email.split("@")[0],
            color: colorForEmail(u.email),
            avatarUrl: u.avatarUrl,
          })),
        );
      })
      .catch(() => {});
  }, []);
  return users;
}

export function Avatar({ user, size = 24 }: { user: DirectoryUser | null; size?: number }) {
  const [gravatarHash, setGravatarHash] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  // Reset failure state if the image source changes (e.g. user uploads a new pic)
  const imageSource = user?.avatarUrl ?? null;
  useEffect(() => {
    setImgFailed(false);
  }, [imageSource]);

  // Compute a Gravatar SHA-256 hash on demand for users without an uploaded pic
  useEffect(() => {
    if (!user || user.avatarUrl) return;
    let cancelled = false;
    sha256Hex(user.email.trim().toLowerCase()).then((h) => {
      if (!cancelled) setGravatarHash(h);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  if (!user) {
    return (
      <span
        title="Unassigned"
        style={{
          width: size, height: size, borderRadius: "50%",
          border: "1.5px dashed var(--color-text-tertiary)",
          color: "var(--color-text-tertiary)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: Math.round(size * 0.45),
          flexShrink: 0,
        }}
      >?</span>
    );
  }

  const px = Math.round(size * (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 2));
  const src = user.avatarUrl
    ? user.avatarUrl
    : gravatarHash
      ? `https://www.gravatar.com/avatar/${gravatarHash}?s=${px}&d=404`
      : null;

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={user.label}
        title={`${user.label} (${user.email})`}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setImgFailed(true)}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0, display: "inline-block",
          background: user.color,
        }}
      />
    );
  }

  return (
    <span
      title={`${user.label} (${user.email})`}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: user.color, color: "white",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: Math.round(size * 0.45),
        fontWeight: 600, flexShrink: 0,
      }}
    >{user.label[0].toUpperCase()}</span>
  );
}

export function AvatarStack({ emails, users, size = 22, max = 4 }: {
  emails: string[]; users: DirectoryUser[]; size?: number; max?: number;
}) {
  const visible = emails.slice(0, max);
  const overflow = emails.length - visible.length;
  return (
    <div style={{ display: "inline-flex", alignItems: "center" }}>
      {visible.map((e, i) => (
        <span key={e} style={{ marginLeft: i === 0 ? 0 : -6, border: "2px solid white", borderRadius: "50%", display: "inline-flex" }}>
          <Avatar user={userMeta(e, users)} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span style={{
          marginLeft: -6, width: size, height: size, borderRadius: "50%",
          background: "var(--color-text-tertiary)", color: "white",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 600, border: "2px solid white",
        }}>+{overflow}</span>
      )}
    </div>
  );
}

export function fmtDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function quarterFromDate(iso: string | null): { key: string; label: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const q = Math.floor(d.getMonth() / 3) + 1;
  const y = d.getFullYear();
  return { key: `${y}-Q${q}`, label: `Q${q} ${y}` };
}

export function upcomingQuarters(count: number): { key: string; label: string; startDate: string; endDate: string }[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const startQ = Math.floor(now.getMonth() / 3) + 1;
  const startY = now.getFullYear();
  const result: { key: string; label: string; startDate: string; endDate: string }[] = [];
  for (let i = 0; i < count; i++) {
    const offset = startQ - 1 + i;
    const q = (offset % 4) + 1;
    const y = startY + Math.floor(offset / 4);
    const startMonth = (q - 1) * 3;
    const endMonth = startMonth + 3;
    const lastDay = new Date(y, endMonth, 0).getDate();
    result.push({
      key: `${y}-Q${q}`,
      label: `Q${q} ${y}${i === 0 ? " (current)" : ""}`,
      startDate: `${y}-${pad(startMonth + 1)}-01`,
      endDate: `${y}-${pad(endMonth)}-${pad(lastDay)}`,
    });
  }
  return result;
}

export function dueState(iso?: string | null): "overdue" | "today" | "soon" | "future" | null {
  if (!iso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(iso + "T00:00:00");
  if (Number.isNaN(due.getTime())) return null;
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 3) return "soon";
  return "future";
}

export const DUE_STYLE = {
  overdue: { color: "#B91C1C", bg: "#FEE2E2" },
  today: { color: "#0369A1", bg: "#DBEAFE" },
  soon: { color: "#B45309", bg: "#FEF3C7" },
  future: { color: "#475569", bg: "#F1F5F9" },
} as const;

export const PRIORITY_META = {
  low: { label: "Low", color: "#475569", bg: "#E2E8F0" },
  medium: { label: "Medium", color: "#B45309", bg: "#FEF3C7" },
  high: { label: "High", color: "#B91C1C", bg: "#FEE2E2" },
} as const;

export const PROJECT_STATUS_META = {
  planning: { label: "Planning", color: "#475569", bg: "#F1F5F9" },
  active: { label: "Active", color: "#065F46", bg: "#D1FAE5" },
  on_hold: { label: "On hold", color: "#92400E", bg: "#FEF3C7" },
  done: { label: "Done", color: "#1E40AF", bg: "#DBEAFE" },
  archived: { label: "Archived", color: "#64748B", bg: "#F1F5F9" },
} as const;

export const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  fontSize: 13,
  fontFamily: "inherit",
  background: "white",
  outline: "none",
  width: "100%",
  color: "var(--color-text-primary)",
};

/**
 * Asana-style "naked" control: looks like static text until you hover/focus.
 * Use inside the right-side task panel where every line is a field row.
 */
export const panelControlStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid transparent",
  fontSize: 14,
  fontFamily: "inherit",
  background: "transparent",
  outline: "none",
  width: "100%",
  color: "var(--color-text-primary)",
  cursor: "pointer",
  transition: "background 100ms var(--ease-apple), border-color 100ms var(--ease-apple)",
};

export const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 16px", borderRadius: 999,
  background: "var(--color-accent)", border: "none",
  color: "white", fontSize: 13, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
};

export const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "7px 14px", borderRadius: 999,
  background: "transparent", border: "1px solid var(--color-border)",
  color: "var(--color-text-primary)", fontSize: 13, fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit",
};

export function Modal({ title, onClose, children, width = 480 }: {
  title: string; onClose: () => void; children: React.ReactNode; width?: number;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 80,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: 16, boxShadow: "var(--shadow-modal)",
          width: "100%", maxWidth: width, maxHeight: "90vh", overflowY: "auto",
          padding: "20px 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "var(--color-text-secondary)", display: "flex" }} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function MultiUserPicker({
  selected, users, onChange, exclude,
}: {
  selected: string[];
  users: DirectoryUser[];
  onChange: (next: string[]) => void;
  exclude?: string | null;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {users
        .filter((u) => u.email !== exclude)
        .map((u) => {
          const active = selected.includes(u.email);
          return (
            <button
              key={u.email}
              type="button"
              onClick={() =>
                onChange(active ? selected.filter((e) => e !== u.email) : [...selected, u.email])
              }
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 10px", borderRadius: 999,
                border: `1px solid ${active ? u.color : "var(--color-border)"}`,
                background: active ? `${u.color}1A` : "transparent",
                color: active ? u.color : "var(--color-text-primary)",
                fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <Avatar user={u} size={18} />
              {u.label}
            </button>
          );
        })}
    </div>
  );
}
