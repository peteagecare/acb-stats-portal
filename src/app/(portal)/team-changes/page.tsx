"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ChartNote {
  id: string;
  date: string;
  text: string;
  author: string;
  createdAt?: string;
}

interface MeResponse {
  email?: string;
  role?: "admin" | "viewer";
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}
function formatCreated(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function TeamChangesPage() {
  const [notes, setNotes] = useState<ChartNote[] | null>(null);
  const [role, setRole] = useState<"admin" | "viewer" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newDate, setNewDate] = useState(todayStr());
  const [newText, setNewText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MeResponse | null) => setRole(data?.role ?? "viewer"))
      .catch(() => setRole("viewer"));
  }, []);

  useEffect(() => {
    void loadNotes();
  }, []);

  async function loadNotes() {
    setError(null);
    try {
      const res = await fetch("/api/chart-notes");
      if (!res.ok) throw new Error("Failed to load notes");
      const data = await res.json();
      setNotes(data.notes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notes");
      setNotes([]);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/chart-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, text: newText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to add change");
      setNotes(data.notes ?? []);
      setNewText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add change");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry? It will also disappear from the Trends chart.")) return;
    setDeleting(id);
    setError(null);
    try {
      const res = await fetch(`/api/chart-notes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete");
      setNotes(data.notes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(null);
    }
  }

  // Sort most-recent first by the note's business date; tie-break on createdAt.
  const sorted = (notes ?? []).slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });

  // Group by year + month so the timeline reads nicely when there are lots.
  const groups: { key: string; label: string; items: ChartNote[] }[] = [];
  sorted.forEach((n) => {
    const d = new Date(n.date);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const label = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(n);
    else groups.push({ key, label, items: [n] });
  });

  const isAdmin = role === "admin";
  const canLog = role !== null;

  // Build monthly chart data covering every month from earliest to latest note.
  const chartData: { label: string; count: number }[] = [];
  if (sorted.length > 0) {
    const counts = new Map<string, number>();
    sorted.forEach((n) => {
      const d = new Date(n.date);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const dates = sorted.map((n) => new Date(n.date));
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
    const end = new Date(max.getFullYear(), max.getMonth(), 1);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
      const label = cursor.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      chartData.push({ label, count: counts.get(key) ?? 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return (
    <div style={{ padding: "28px 28px 48px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
          Team Changes Tracker
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
          Every chart note added on the{" "}
          <Link href="/trends" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
            Trends
          </Link>{" "}
          page, in chronological order. Use this as a log of campaign launches, hires, process changes — anything that might explain a shift in the numbers.
        </p>
      </div>

      {canLog && (
        <form
          onSubmit={handleAdd}
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)",
            padding: 20,
            marginBottom: 14,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>Log a change</h2>
          <p style={{ margin: "4px 0 14px", fontSize: 12, color: "var(--color-text-secondary)" }}>
            This appears as a marker on the Trends chart on the selected date.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 10, alignItems: "start" }}>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
              style={inputStyle}
            />
            <textarea
              placeholder="e.g. Launched Google Ads brand campaign"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={2}
              required
              style={{ ...inputStyle, resize: "vertical", minHeight: 38 }}
            />
            <button
              type="submit"
              disabled={saving || !newText.trim()}
              style={{
                background: "var(--color-accent)",
                color: "white",
                border: "none",
                padding: "9px 16px",
                borderRadius: "var(--radius-button)",
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? "wait" : "pointer",
                opacity: saving || !newText.trim() ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {saving ? "Logging…" : "Log change"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div
          style={{
            fontSize: 12,
            color: "#9E1A1E",
            background: "#FCE6E7",
            padding: "8px 14px",
            borderRadius: 10,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      {notes === null && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)",
            padding: 32,
            fontSize: 13,
            color: "var(--color-text-secondary)",
            textAlign: "center",
          }}
        >
          Loading…
        </div>
      )}

      {notes?.length === 0 && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)",
            padding: 40,
            fontSize: 14,
            color: "var(--color-text-secondary)",
            textAlign: "center",
          }}
        >
          {canLog
            ? "No team changes logged yet. Use the form above to add your first one."
            : "No team changes logged yet."}
        </div>
      )}

      {chartData.length > 0 && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)",
            padding: 20,
            marginBottom: 22,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 2 }}>
            Changes per month
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 14 }}>
            {sorted.length} {sorted.length === 1 ? "change" : "changes"} logged
          </div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#94A3B8" }}
                  axisLine={false}
                  tickLine={false}
                  interval={chartData.length > 18 ? Math.floor(chartData.length / 12) : 0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94A3B8" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "#F1F5F9" }}
                  content={({ active: isActive, payload, label }) => {
                    if (!isActive || !payload?.length) return null;
                    const n = Number(payload[0].value);
                    return (
                      <div
                        style={{
                          background: "#fff",
                          borderRadius: 12,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                          padding: "8px 12px",
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#1D1D1F" }}>{String(label)}</div>
                        <div style={{ color: "var(--color-accent)", fontWeight: 600 }}>
                          {n} {n === 1 ? "change" : "changes"}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.key} style={{ marginBottom: 22 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 10,
            }}
          >
            {g.label}
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-card)",
              boxShadow: "var(--shadow-card)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {g.items.map((n) => (
              <div
                key={n.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "10px 1fr auto",
                  gap: 14,
                  alignItems: "start",
                  padding: "6px 4px",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: "var(--color-accent)",
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                    {formatNoteDate(n.date)}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-text-primary)", marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                    {n.text}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 4 }}>
                    by {n.author}
                    {n.createdAt && ` · logged ${formatCreated(n.createdAt)}`}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(n.id)}
                    disabled={deleting === n.id}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(217,61,66,0.3)",
                      color: "#9E1A1E",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 999,
                      cursor: deleting === n.id ? "wait" : "pointer",
                      opacity: deleting === n.id ? 0.5 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {deleting === n.id ? "…" : "Delete"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-button)",
  padding: "9px 12px",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--color-text-primary)",
  background: "white",
  outline: "none",
  fontFamily: "inherit",
};
