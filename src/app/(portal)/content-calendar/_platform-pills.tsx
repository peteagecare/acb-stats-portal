"use client";

import {
  CALENDAR_PLATFORMS,
  CALENDAR_TYPES,
  CalendarPlatform,
  CalendarType,
  PLATFORM_COLOURS,
  TYPE_COLOURS,
  shortPlatformLabel,
} from "@/lib/content-calendar";

type Colours = { bg: string; fg: string };

/**
 * Multi-select toggle pills. Selected chips render in their brand colour;
 * unselected chips render as outlined neutrals. Click toggles membership.
 */
function TogglePills<T extends string>({
  options,
  value,
  onChange,
  colours,
  label,
  size = "md",
  ariaLabel,
}: {
  options: readonly T[];
  value: T[];
  onChange: (next: T[]) => void;
  colours: Record<T, Colours>;
  label?: (option: T) => string;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const selected = new Set(value);
  function toggle(option: T) {
    const next = new Set(selected);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    onChange(options.filter((o) => next.has(o)));
  }
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((option) => {
        const on = selected.has(option);
        const c = colours[option] ?? FALLBACK_COLOURS;
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            aria-pressed={on}
            style={pillStyle(on, c, size)}
          >
            {label ? label(option) : option}
          </button>
        );
      })}
    </div>
  );
}

/** Read-only display of a list of pills. Unknown values are skipped quietly. */
function PillsDisplay<T extends string>({
  value,
  colours,
  label,
  size = "sm",
}: {
  value: T[] | undefined;
  colours: Record<T, Colours>;
  label?: (option: T) => string;
  size?: "sm" | "md";
}) {
  const visible = (value ?? []).filter((v) => colours[v] !== undefined);
  if (!visible.length) return <span style={{ color: "#94a3b8" }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {visible.map((option) => (
        <span key={option} style={pillStyle(true, colours[option], size)}>
          {label ? label(option) : option}
        </span>
      ))}
    </div>
  );
}

const FALLBACK_COLOURS: Colours = { bg: "#e5e7eb", fg: "#374151" };

export function PlatformPills(props: {
  value: CalendarPlatform[];
  onChange: (next: CalendarPlatform[]) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  return (
    <TogglePills
      options={CALENDAR_PLATFORMS}
      colours={PLATFORM_COLOURS}
      label={shortPlatformLabel}
      ariaLabel={props.ariaLabel ?? "Select platforms"}
      {...props}
    />
  );
}

export function PlatformPillsDisplay(props: { value: CalendarPlatform[] | undefined; size?: "sm" | "md" }) {
  return (
    <PillsDisplay
      value={props.value}
      colours={PLATFORM_COLOURS}
      label={shortPlatformLabel}
      size={props.size}
    />
  );
}

export function TypePills(props: {
  value: CalendarType[];
  onChange: (next: CalendarType[]) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  return (
    <TogglePills
      options={CALENDAR_TYPES}
      colours={TYPE_COLOURS}
      ariaLabel={props.ariaLabel ?? "Select types"}
      {...props}
    />
  );
}

export function TypePillsDisplay(props: { value: CalendarType[] | undefined; size?: "sm" | "md" }) {
  return <PillsDisplay value={props.value} colours={TYPE_COLOURS} size={props.size} />;
}

function pillStyle(on: boolean, colours: Colours, size: "sm" | "md"): React.CSSProperties {
  const padding = size === "sm" ? "2px 8px" : "5px 10px";
  const fontSize = size === "sm" ? 11 : 12;
  return {
    padding,
    borderRadius: 999,
    fontSize,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
    background: on ? colours.bg : "transparent",
    color: on ? colours.fg : "var(--color-text-secondary)",
    border: on ? `1px solid ${colours.bg}` : "1px solid var(--color-border)",
    transition: "background 120ms var(--ease-apple), border-color 120ms var(--ease-apple)",
  };
}
