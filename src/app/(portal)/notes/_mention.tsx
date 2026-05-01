"use client";

import { Mention } from "@tiptap/extension-mention";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";

type User = { email: string; label: string };

let _userCache: User[] | null = null;
let _inflight: Promise<User[]> | null = null;

async function loadUsers(): Promise<User[]> {
  if (_userCache) return _userCache;
  if (_inflight) return _inflight;
  _inflight = fetch("/api/users", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { users: [] }))
    .then((j: { users?: User[] }) => {
      _userCache = j.users ?? [];
      _inflight = null;
      return _userCache;
    })
    .catch(() => {
      _inflight = null;
      return [];
    });
  return _inflight;
}

interface MentionListRef {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

const MentionList = forwardRef<
  MentionListRef,
  {
    items: User[];
    command: (user: User) => void;
  }
>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);
  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        setSelected((s) => (s + 1) % Math.max(items.length, 1));
        return true;
      }
      if (e.key === "ArrowUp") {
        setSelected((s) => (s - 1 + items.length) % Math.max(items.length, 1));
        return true;
      }
      if (e.key === "Enter") {
        const u = items[selected];
        if (u) command(u);
        return true;
      }
      return false;
    },
  }));

  return (
    <div style={{
      width: 240,
      background: "white",
      borderRadius: 12,
      boxShadow: "0 8px 28px rgba(0,0,0,0.16)",
      border: "1px solid var(--color-border)",
      overflow: "hidden",
      fontSize: 13,
    }}>
      {items.length === 0 ? (
        <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--color-text-tertiary)" }}>
          No matches
        </div>
      ) : (
        <div style={{ padding: 4, maxHeight: 280, overflowY: "auto" }}>
          {items.map((u, i) => (
            <button
              key={u.email}
              onMouseDown={(e) => { e.preventDefault(); command(u); }}
              onMouseEnter={() => setSelected(i)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "7px 10px", borderRadius: 8,
                border: "none", cursor: "pointer", textAlign: "left",
                background: i === selected ? "rgba(0,113,227,0.1)" : "transparent",
                color: i === selected ? "var(--color-accent)" : "var(--color-text-primary)",
                fontFamily: "inherit",
              }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: "50%",
                background: "var(--color-accent)", color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 600,
              }}>{u.label.slice(0, 1).toUpperCase()}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 500 }}>{u.label}</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--color-text-tertiary)" }}>{u.email}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
MentionList.displayName = "MentionList";

// We piggy-back on Mention's built-in `id` (email — unique) and `label` (display name).
// HTML render uses both as data-* so the server can extract mentions from saved HTML.
export const UserMention = Mention.configure({
  HTMLAttributes: { class: "note-mention" },
  renderText({ node }) {
    return `@${node.attrs.label ?? node.attrs.id ?? ""}`;
  },
  renderHTML({ options, node }) {
    return [
      "span",
      {
        ...options.HTMLAttributes,
        "data-mention-email": node.attrs.id ?? "",
        "data-mention-label": node.attrs.label ?? "",
      },
      `@${node.attrs.label ?? node.attrs.id ?? ""}`,
    ];
  },
  suggestion: {
    char: "@",
    items: async ({ query }: { query: string }) => {
      const users = await loadUsers();
      const q = query.trim().toLowerCase();
      const filtered = q
        ? users.filter((u) => u.label.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
        : users;
      return filtered.slice(0, 8);
    },
    command: ({ editor, range, props }) => {
      // We pack the user via { id: email, label } onto the suggestion command
      const id = String(props.id ?? "");
      const label = String(props.label ?? id);
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: "mention", attrs: { id, label } },
          { type: "text", text: " " },
        ])
        .run();
    },
    render: () => {
      let container: HTMLDivElement | null = null;
      let root: Root | null = null;
      let listRef: MentionListRef | null = null;
      type SuggestionProps = {
        items: User[];
        command: (attrs: { id: string; label: string }) => void;
      };
      let propsCache: SuggestionProps | null = null;

      function position(rect: { left: number; bottom: number }) {
        if (!container) return;
        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.bottom + 6}px`;
      }

      function paint() {
        if (!root || !propsCache) return;
        root.render(
          <MentionList
            ref={(r) => { listRef = r; }}
            items={propsCache.items}
            command={(u) => propsCache?.command({ id: u.email, label: u.label })}
          />,
        );
      }

      return {
        onStart: (props) => {
          container = document.createElement("div");
          container.style.position = "fixed";
          container.style.zIndex = "1000";
          document.body.appendChild(container);
          root = createRoot(container);
          propsCache = {
            items: props.items as User[],
            command: props.command as SuggestionProps["command"],
          };
          paint();
          const rect = props.clientRect?.();
          if (rect) position(rect);
        },
        onUpdate: (props) => {
          propsCache = {
            items: props.items as User[],
            command: props.command as SuggestionProps["command"],
          };
          paint();
          const rect = props.clientRect?.();
          if (rect) position(rect);
        },
        onKeyDown: (props) => {
          if (props.event.key === "Escape") return false;
          return listRef?.onKeyDown(props.event) ?? false;
        },
        onExit: () => {
          root?.unmount();
          container?.remove();
          root = null;
          container = null;
          listRef = null;
          propsCache = null;
        },
      };
    },
  },
});
