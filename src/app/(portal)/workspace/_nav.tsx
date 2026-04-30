"use client";

import Link from "next/link";

export type WorkspaceTab = "dashboard" | "my-tasks" | "companies";

const TABS: { key: WorkspaceTab; label: string; href: string }[] = [
  { key: "dashboard", label: "My Dashboard", href: "/workspace" },
  { key: "my-tasks", label: "My Tasks", href: "/workspace/my-tasks" },
  { key: "companies", label: "Companies", href: "/workspace/companies" },
];

export function WorkspaceNav({ current }: { current: WorkspaceTab }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 22, borderBottom: "1px solid var(--color-border)" }}>
      {TABS.map((t) => {
        const active = current === t.key;
        return (
          <Link
            key={t.key}
            href={t.href}
            style={{
              padding: "10px 14px",
              textDecoration: "none",
              borderBottom: active ? "2px solid var(--color-accent)" : "2px solid transparent",
              color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              fontWeight: active ? 600 : 500,
              fontSize: 13,
              fontFamily: "inherit",
              marginBottom: -1,
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
