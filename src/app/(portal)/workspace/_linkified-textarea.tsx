"use client";

import { useEffect, useRef, useState } from "react";

const URL_REGEX = /(https?:\/\/[^\s<>]+)|(www\.[^\s<>]+)/g;

function renderLinkified(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) out.push(text.slice(lastIndex, match.index));
    const raw = match[0];
    // Trim trailing punctuation that's almost never part of a real URL
    const trimMatch = raw.match(/^(.*?)([)\].,;:!?]+)$/);
    const url = trimMatch ? trimMatch[1] : raw;
    const trail = trimMatch ? trimMatch[2] : "";
    const href = url.startsWith("http") ? url : `https://${url}`;
    out.push(
      <a
        key={`${match.index}-${url}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{ color: "var(--color-accent)", textDecoration: "underline" }}
      >
        {url}
      </a>,
    );
    if (trail) out.push(trail);
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}

/** Textarea that swaps to a read-only div (with auto-linked URLs) when not
 *  focused. Click the div to edit. Mirrors the default <textarea> styling so
 *  it can drop into existing layouts.
 */
export function LinkifiedTextarea({
  value,
  onChange,
  onCommit,
  placeholder,
  rows = 4,
  style,
}: {
  value: string;
  onChange: (next: string) => void;
  onCommit?: () => void;
  placeholder?: string;
  rows?: number;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onCommit?.();
        }}
        placeholder={placeholder}
        rows={rows}
        style={style}
      />
    );
  }

  const empty = !value.trim();
  return (
    <div
      onClick={() => setEditing(true)}
      style={{
        ...style,
        minHeight: `${rows * 1.5}em`,
        cursor: "text",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        color: empty ? "var(--color-text-tertiary)" : undefined,
      }}
    >
      {empty ? (placeholder ?? "") : renderLinkified(value)}
    </div>
  );
}
