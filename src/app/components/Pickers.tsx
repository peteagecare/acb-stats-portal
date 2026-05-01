"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/* ─── primitive: usePopover + Popover ─── */

export function usePopover<T extends HTMLElement = HTMLButtonElement>() {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<T | null>(null);

  function show() {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen(true);
  }
  function hide() { setOpen(false); }
  function toggle() { open ? hide() : show(); }

  return { open, rect, triggerRef, show, hide, toggle };
}

export function Popover({
  open, onClose, anchorRect, width = 280, children, align = "left",
}: {
  open: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
  width?: number;
  children: ReactNode;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close on outside click + Esc
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open || !anchorRect) return null;

  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = align === "right" ? anchorRect.right - width : anchorRect.left;
  left = Math.max(margin, Math.min(left, vw - width - margin));

  const spaceBelow = vh - anchorRect.bottom - margin - 6;
  const spaceAbove = anchorRect.top - margin - 6;
  const flipUp = spaceBelow < 220 && spaceAbove > spaceBelow;
  const top = flipUp ? Math.max(margin, anchorRect.top - 6) : anchorRect.bottom + 6;
  const maxH = flipUp ? spaceAbove : spaceBelow;

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: flipUp ? undefined : top,
        bottom: flipUp ? vh - top : undefined,
        left,
        width,
        zIndex: 1200,
        background: "white",
        borderRadius: 12,
        boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
        border: "1px solid var(--color-border)",
        overflow: "hidden",
        maxHeight: Math.max(180, Math.min(480, maxH)),
        display: "flex",
        flexDirection: "column",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

/* ─── shared row style ─── */

function rowStyle(active: boolean): CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 10,
    width: "100%", padding: "8px 10px", borderRadius: 8,
    border: "none", cursor: "pointer", textAlign: "left",
    background: active ? "rgba(0,113,227,0.08)" : "transparent",
    color: "var(--color-text-primary)",
    fontFamily: "inherit", fontSize: 13,
  };
}

function avatarCircle(color: string, label: string, size = 26): CSSProperties {
  void label;
  return {
    width: size, height: size, borderRadius: "50%",
    background: color, color: "white",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: Math.round(size * 0.42),
    flexShrink: 0,
  };
}

function userInitial(label: string): string {
  return (label || "?").trim().slice(0, 1).toUpperCase();
}

/* ─── UserPicker ─── */

export interface PickerUser { email: string; label: string; color: string }

export function UserPicker({
  selected, users, onChange, children, popoverWidth = 320,
}: {
  selected: string | null;
  users: PickerUser[];
  onChange: (next: string | null) => void;
  /** A render function that returns the trigger element. The ref must be applied. */
  children: (props: { onClick: () => void; ref: React.Ref<HTMLButtonElement> }) => ReactNode;
  popoverWidth?: number;
}) {
  const { open, rect, triggerRef, toggle, hide } = usePopover<HTMLButtonElement>();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.label.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, query]);

  return (
    <>
      {children({ onClick: toggle, ref: triggerRef })}
      <Popover open={open} onClose={hide} anchorRect={rect} width={popoverWidth}>
        <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--color-border)" }}>
          <input
            autoFocus
            placeholder="Find a person…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%", border: "none", outline: "none",
              padding: "4px 0", fontSize: 13, fontFamily: "inherit",
              background: "transparent",
            }}
          />
        </div>
        <div style={{ overflowY: "auto", padding: 4 }}>
          <button
            onClick={() => { onChange(null); hide(); }}
            style={rowStyle(!selected)}
          >
            <span style={{
              width: 26, height: 26, borderRadius: "50%",
              border: "1.5px dashed var(--color-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--color-text-tertiary)", flexShrink: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 21c0-3.5 3-6 7-6s7 2.5 7 6" />
              </svg>
            </span>
            <span style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>Unassigned</span>
          </button>
          {filtered.length === 0 && (
            <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--color-text-tertiary)" }}>
              No matches
            </div>
          )}
          {filtered.map((u) => (
            <button
              key={u.email}
              onClick={() => { onChange(u.email); hide(); }}
              style={rowStyle(u.email === selected)}
            >
              <span style={avatarCircle(u.color, u.label)}>{userInitial(u.label)}</span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0, alignItems: "flex-start" }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{u.label}</span>
                <span style={{
                  fontSize: 11, color: "var(--color-text-tertiary)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  maxWidth: popoverWidth - 70,
                }}>{u.email}</span>
              </span>
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

/* ─── EnumPicker (Status, Priority, Section…) ─── */

export interface PickerOption {
  value: string;
  label: string;
  /** Optional accent — renders a small dot */
  color?: string;
}

export function EnumPicker({
  selected, options, onChange, children, popoverWidth = 220,
}: {
  selected: string;
  options: PickerOption[];
  onChange: (next: string) => void;
  children: (props: { onClick: () => void; ref: React.Ref<HTMLButtonElement> }) => ReactNode;
  popoverWidth?: number;
}) {
  const { open, rect, triggerRef, toggle, hide } = usePopover<HTMLButtonElement>();
  return (
    <>
      {children({ onClick: toggle, ref: triggerRef })}
      <Popover open={open} onClose={hide} anchorRect={rect} width={popoverWidth}>
        <div style={{ overflowY: "auto", padding: 4 }}>
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); hide(); }}
              style={rowStyle(o.value === selected)}
            >
              {o.color && (
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: o.color, flexShrink: 0,
                }} />
              )}
              <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{o.label}</span>
              {o.value === selected && (
                <svg style={{ marginLeft: "auto", color: "var(--color-accent)" }}
                     width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <polyline points="4,12 9,17 20,6" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

/* ─── ProjectPicker ─── */

export interface PickerCompany { id: string; name: string; projects: { id: string; name: string }[] }

export function ProjectPicker({
  selected, companies, onChange, children, popoverWidth = 300,
}: {
  selected: string | null;
  companies: PickerCompany[];
  onChange: (next: string | null) => void;
  children: (props: { onClick: () => void; ref: React.Ref<HTMLButtonElement> }) => ReactNode;
  popoverWidth?: number;
}) {
  const { open, rect, triggerRef, toggle, hide } = usePopover<HTMLButtonElement>();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies
      .map((c) => ({
        ...c,
        projects: q
          ? c.projects.filter((p) => p.name.toLowerCase().includes(q))
          : c.projects,
      }))
      .filter((c) => c.projects.length > 0);
  }, [companies, query]);

  return (
    <>
      {children({ onClick: toggle, ref: triggerRef })}
      <Popover open={open} onClose={hide} anchorRect={rect} width={popoverWidth}>
        <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--color-border)" }}>
          <input
            autoFocus
            placeholder="Find a project…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%", border: "none", outline: "none",
              padding: "4px 0", fontSize: 13, fontFamily: "inherit",
              background: "transparent",
            }}
          />
        </div>
        <div style={{ overflowY: "auto", padding: 4 }}>
          {selected && (
            <button
              onClick={() => { onChange(null); hide(); }}
              style={{ ...rowStyle(false), color: "var(--color-text-secondary)", fontSize: 12 }}
            >
              Clear project
            </button>
          )}
          {groups.length === 0 && (
            <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--color-text-tertiary)" }}>
              No matches
            </div>
          )}
          {groups.map((c) => (
            <div key={c.id}>
              <div style={{
                padding: "8px 10px 4px",
                fontSize: 11, fontWeight: 600,
                color: "var(--color-text-tertiary)",
                textTransform: "uppercase", letterSpacing: 0.4,
              }}>{c.name}</div>
              {c.projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onChange(p.id); hide(); }}
                  style={rowStyle(p.id === selected)}
                >
                  <span style={{ fontSize: 13 }}>{p.name}</span>
                  {p.id === selected && (
                    <svg style={{ marginLeft: "auto", color: "var(--color-accent)" }}
                         width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <polyline points="4,12 9,17 20,6" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </Popover>
    </>
  );
}

/* ─── DatePicker ─── */

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function dateFromIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function DatePicker({
  value, onChange, children, popoverWidth = 280,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  children: (props: { onClick: () => void; ref: React.Ref<HTMLButtonElement> }) => ReactNode;
  popoverWidth?: number;
}) {
  const { open, rect, triggerRef, toggle, hide } = usePopover<HTMLButtonElement>();
  const selectedDate = value ? dateFromIso(value) : null;
  const today = startOfDay(new Date());
  const initial = selectedDate ?? today;
  const [view, setView] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  // Reset view when popover opens, in case caller changed value externally
  useLayoutEffect(() => {
    if (!open) return;
    const base = (value ? dateFromIso(value) : null) ?? today;
    setView(new Date(base.getFullYear(), base.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startDay = view.getDay() === 0 ? 6 : view.getDay() - 1; // Mon=0
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();

  type Cell = { d: Date; otherMonth: boolean };
  const cells: Cell[] = [];
  for (let i = startDay; i > 0; i--) {
    const d = new Date(view.getFullYear(), view.getMonth(), 1 - i);
    cells.push({ d, otherMonth: true });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ d: new Date(view.getFullYear(), view.getMonth(), i), otherMonth: false });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].d;
    cells.push({
      d: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      otherMonth: true,
    });
  }

  function changeMonth(delta: number) {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  return (
    <>
      {children({ onClick: toggle, ref: triggerRef })}
      <Popover open={open} onClose={hide} anchorRect={rect} width={popoverWidth}>
        <div style={{ padding: "10px 12px 6px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <button
              onClick={() => changeMonth(-1)}
              aria-label="Previous month"
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                padding: 4, color: "var(--color-text-secondary)", display: "flex",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,6 9,12 15,18" /></svg>
            </button>
            <div style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 600 }}>
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </div>
            <button
              onClick={() => changeMonth(1)}
              aria-label="Next month"
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                padding: 4, color: "var(--color-text-secondary)", display: "flex",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9,6 15,12 9,18" /></svg>
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center" }}>
            {WEEKDAYS.map((w, i) => (
              <div key={i} style={{ fontSize: 11, color: "var(--color-text-tertiary)", padding: "4px 0", fontWeight: 600 }}>{w}</div>
            ))}
            {cells.map(({ d, otherMonth }, i) => {
              const isSelected = selectedDate ? sameDay(d, selectedDate) : false;
              const isToday = sameDay(d, today);
              const color = isSelected
                ? "white"
                : otherMonth ? "var(--color-text-tertiary)" : "var(--color-text-primary)";
              const bg = isSelected
                ? "var(--color-accent)"
                : isToday ? "rgba(0,113,227,0.1)" : "transparent";
              return (
                <button
                  key={i}
                  onClick={() => { onChange(isoFromDate(d)); hide(); }}
                  style={{
                    width: 36, height: 36, padding: 0,
                    border: "none", cursor: "pointer",
                    borderRadius: 8,
                    background: bg, color,
                    fontSize: 13, fontWeight: isSelected || isToday ? 600 : 400,
                    fontFamily: "inherit",
                    margin: "0 auto",
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between",
          padding: "8px 14px",
          borderTop: "1px solid var(--color-border)",
        }}>
          <button
            onClick={() => { onChange(null); hide(); }}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--color-accent)", fontSize: 13, fontWeight: 500, fontFamily: "inherit", padding: "4px 0",
            }}
          >Clear</button>
          <button
            onClick={() => { onChange(isoFromDate(today)); hide(); }}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--color-accent)", fontSize: 13, fontWeight: 500, fontFamily: "inherit", padding: "4px 0",
            }}
          >Today</button>
        </div>
      </Popover>
    </>
  );
}
