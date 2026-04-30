"use client";

import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";

export type SlashCommandHandlers = {
  onPickTodo: (title: string) => Promise<{ id: string } | null>;
  onPickImage: () => void;
};

export type SlashItem = {
  key: string;
  label: string;
  hint: string;
  keywords: string[];
  run: (editor: Editor, range: Range) => void;
};

function buildItems(handlers: SlashCommandHandlers): SlashItem[] {
  return [
    {
      key: "h1",
      label: "Heading 1",
      hint: "Large section title",
      keywords: ["h1", "heading", "title"],
      run: (editor, range) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
    },
    {
      key: "h2",
      label: "Heading 2",
      hint: "Section subtitle",
      keywords: ["h2", "heading"],
      run: (editor, range) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
    },
    {
      key: "h3",
      label: "Heading 3",
      hint: "Smaller heading",
      keywords: ["h3", "heading"],
      run: (editor, range) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
    },
    {
      key: "bullet",
      label: "Bullet list",
      hint: "Unordered list",
      keywords: ["bullet", "list", "ul"],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      key: "ordered",
      label: "Numbered list",
      hint: "Ordered list",
      keywords: ["numbered", "ordered", "ol", "list"],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      key: "quote",
      label: "Quote",
      hint: "Highlight a quotation",
      keywords: ["quote", "blockquote"],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      key: "code",
      label: "Code block",
      hint: "Monospaced code",
      keywords: ["code", "pre"],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
      key: "divider",
      label: "Divider",
      hint: "Horizontal line",
      keywords: ["divider", "hr", "rule"],
      run: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      key: "image",
      label: "Image",
      hint: "Upload and insert",
      keywords: ["image", "img", "photo", "picture"],
      run: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        handlers.onPickImage();
      },
    },
    {
      key: "todo",
      label: "To-do",
      hint: "Add to task list",
      keywords: ["todo", "task", "check"],
      run: (editor, range) => {
        // Slash menu component handles two-step input flow; here we just remove the slash query.
        editor.chain().focus().deleteRange(range).run();
      },
    },
  ];
}

export interface SlashMenuRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface SlashMenuProps {
  query: string;
  command: (item: SlashItem) => void;
  handlers: SlashCommandHandlers;
  editor: Editor;
}

const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(({ query, command, handlers, editor }, ref) => {
  const items = buildItems(handlers);
  const filtered = filterItems(items, query);
  const [selected, setSelected] = useState(0);
  const [todoMode, setTodoMode] = useState(false);
  const [todoTitle, setTodoTitle] = useState("");

  useEffect(() => {
    setSelected(0);
  }, [query]);

  function pick(item: SlashItem) {
    if (item.key === "todo") {
      setTodoMode(true);
      setTodoTitle("");
      return;
    }
    command(item);
  }

  async function submitTodo() {
    const t = todoTitle.trim();
    if (!t) return;
    // Remove the slash query and close the menu first so the cursor is in the right place
    const todoItem = items.find((i) => i.key === "todo");
    if (todoItem) command(todoItem);
    // Persist to the rail and get back the rail task id
    const rail = await handlers.onPickTodo(t);
    if (!rail) return;
    // Insert an inline task-list checkbox stamped with the rail task id
    editor.chain().focus().insertContent({
      type: "taskList",
      content: [{
        type: "taskItem",
        attrs: { checked: false, taskId: rail.id },
        content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
      }],
    }).run();
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent) => {
      if (todoMode) {
        if (event.key === "Enter") { submitTodo(); return true; }
        if (event.key === "Escape") { setTodoMode(false); return true; }
        return false;
      }
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % Math.max(filtered.length, 1));
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelected((s) => (s - 1 + filtered.length) % Math.max(filtered.length, 1));
        return true;
      }
      if (event.key === "Enter") {
        const item = filtered[selected];
        if (item) pick(item);
        return true;
      }
      return false;
    },
  }));

  return (
    <div style={{
      width: 260,
      background: "white",
      borderRadius: 12,
      boxShadow: "0 8px 28px rgba(0,0,0,0.16)",
      border: "1px solid var(--color-border)",
      overflow: "hidden",
      fontSize: 13,
    }}>
      {todoMode ? (
        <div style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
            New to-do
          </div>
          <input
            autoFocus
            value={todoTitle}
            onChange={(e) => setTodoTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); submitTodo(); }
              else if (e.key === "Escape") { e.preventDefault(); setTodoMode(false); }
            }}
            placeholder="Task title…"
            style={{
              width: "100%",
              padding: "7px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 6 }}>
            Press Enter to add · Esc to cancel
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "12px 14px", color: "var(--color-text-tertiary)", fontSize: 12 }}>
          No matches.
        </div>
      ) : (
        <div style={{ maxHeight: 320, overflowY: "auto", padding: 4 }}>
          {filtered.map((item, idx) => (
            <button
              key={item.key}
              onMouseDown={(e) => { e.preventDefault(); pick(item); }}
              onMouseEnter={() => setSelected(idx)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "8px 10px", borderRadius: 8,
                background: idx === selected ? "rgba(0,113,227,0.1)" : "transparent",
                border: "none", cursor: "pointer",
                fontFamily: "inherit", textAlign: "left",
                color: idx === selected ? "var(--color-accent)" : "var(--color-text-primary)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{item.hint}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
SlashMenu.displayName = "SlashMenu";

function filterItems(items: SlashItem[], query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((i) =>
    i.label.toLowerCase().includes(q) ||
    i.keywords.some((k) => k.includes(q)),
  );
}

export function createSlashCommand(handlers: SlashCommandHandlers) {
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: "/",
          startOfLine: false,
          allowSpaces: false,
          command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashItem }) => {
            props.run(editor, range);
          },
          items: ({ query }: { query: string }) => filterItems(buildItems(handlers), query),
          render: () => {
            let container: HTMLDivElement | null = null;
            let root: Root | null = null;
            let menuRef: SlashMenuRef | null = null;

            function position(rect: { left: number; top: number; bottom: number }) {
              if (!container) return;
              container.style.left = `${rect.left}px`;
              container.style.top = `${rect.bottom + 6}px`;
            }

            return {
              onStart: (props: {
                clientRect?: (() => DOMRect | null) | null;
                query: string;
                command: (item: SlashItem) => void;
                editor: Editor;
              }) => {
                container = document.createElement("div");
                container.style.position = "fixed";
                container.style.zIndex = "1000";
                document.body.appendChild(container);
                root = createRoot(container);
                root.render(
                  <SlashMenu
                    ref={(r) => { menuRef = r; }}
                    query={props.query}
                    command={props.command}
                    handlers={handlers}
                    editor={props.editor}
                  />,
                );
                const rect = props.clientRect?.();
                if (rect) position(rect);
              },
              onUpdate: (props: {
                clientRect?: (() => DOMRect | null) | null;
                query: string;
                command: (item: SlashItem) => void;
                editor: Editor;
              }) => {
                if (!root) return;
                root.render(
                  <SlashMenu
                    ref={(r) => { menuRef = r; }}
                    query={props.query}
                    command={props.command}
                    handlers={handlers}
                    editor={props.editor}
                  />,
                );
                const rect = props.clientRect?.();
                if (rect) position(rect);
              },
              onKeyDown: (props: { event: KeyboardEvent }) => {
                if (props.event.key === "Escape") {
                  return false;
                }
                return menuRef?.onKeyDown(props.event) ?? false;
              },
              onExit: () => {
                root?.unmount();
                container?.remove();
                root = null;
                container = null;
                menuRef = null;
              },
            };
          },
        }),
      ];
    },
  });
}
