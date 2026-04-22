"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  label: string;
  href: string;
  fetchUrl: string;
  extract: (data: unknown) => number | string | null;
  format?: (value: number | string) => string;
  subtitle?: string;
  accent?: string;
};

export default function KpiTile({ label, href, fetchUrl, extract, format, subtitle, accent = "#0071E3" }: Props) {
  const [value, setValue] = useState<number | string | null | "loading" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(fetchUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => {
        if (cancelled) return;
        const v = extract(data);
        setValue(v);
      })
      .catch(() => {
        if (!cancelled) setValue("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl]);

  const display =
    value === "loading"
      ? null
      : value === "error"
      ? "—"
      : value === null
      ? "—"
      : format
      ? format(value)
      : typeof value === "number"
      ? value.toLocaleString()
      : value;

  return (
    <Link
      href={href}
      style={{
        display: "block",
        background: "var(--bg-card)",
        borderRadius: "var(--radius-card)",
        padding: "18px 20px",
        boxShadow: "var(--shadow-card)",
        textDecoration: "none",
        color: "inherit",
        transition: "box-shadow 150ms var(--ease-apple), transform 150ms var(--ease-apple)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-card-hover)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-card)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: accent }} />
        <span style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 500 }}>{label}</span>
      </div>

      <div style={{ marginTop: 10, minHeight: 38, display: "flex", alignItems: "baseline" }}>
        {value === "loading" ? (
          <span
            style={{
              display: "inline-block",
              width: 80,
              height: 28,
              borderRadius: 6,
              background: "rgba(0,0,0,0.06)",
              animation: "pulse 1.6s ease-in-out infinite",
            }}
          />
        ) : (
          <span style={{ fontSize: 28, fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
            {display}
          </span>
        )}
      </div>

      {subtitle && (
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--color-text-tertiary)" }}>{subtitle}</div>
      )}
    </Link>
  );
}
