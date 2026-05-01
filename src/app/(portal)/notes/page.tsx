"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { createSlashCommand } from "./_slash";
import { ResizableImageExtension } from "./_image";
import { UserMention } from "./_mention";
import { TagFilterChips, TagPicker, TagPillList, useTags } from "../workspace/_tags";

const LinkedTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      taskId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-task-id"),
        renderHTML: (attrs) => attrs.taskId ? { "data-task-id": attrs.taskId } : {},
      },
    };
  },
});

function scanLinkedTasks(editor: Editor): Map<string, boolean> {
  const m = new Map<string, boolean>();
  editor.state.doc.descendants((node) => {
    if (node.type.name === "taskItem" && node.attrs.taskId) {
      m.set(node.attrs.taskId, !!node.attrs.checked);
    }
  });
  return m;
}

function findTaskItemPos(editor: Editor, taskId: string): number | null {
  let foundPos: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (foundPos != null) return false;
    if (node.type.name === "taskItem" && node.attrs.taskId === taskId) {
      foundPos = pos;
      return false;
    }
    return true;
  });
  return foundPos;
}
import "./notes.css";

interface Note {
  id: string;
  title: string;
  body: string;
  meetingDate: string | null;
  authorEmail: string;
  accessMode: "everyone" | "restricted";
  accessUsers?: string[];
  tagIds?: string[];
  createdAt: string;
  updatedAt: string;
}

interface NoteTask {
  id: string;
  noteId: string;
  title: string;
  completed: boolean;
  projectId: string | null;
  promotedTaskId: string | null;
  order: number;
  createdAt: string;
}

interface CompanyWithProjects {
  id: string;
  name: string;
  projects: { id: string; name: string }[];
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set());
  const [companiesWithProjects, setCompaniesWithProjects] = useState<CompanyWithProjects[]>([]);
  const [listOpen, setListOpen] = useState(true);
  const [tasksOpen, setTasksOpen] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("notes-list-open") === "0") setListOpen(false);
    if (localStorage.getItem("notes-tasks-open") === "0") setTasksOpen(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("notes-list-open", listOpen ? "1" : "0");
  }, [listOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("notes-tasks-open", tasksOpen ? "1" : "0");
  }, [tasksOpen]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notes", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { notes: Note[] };
      setNotes(json.notes);
      setError(null);
      setSelectedId((prev) => {
        if (prev && json.notes.find((n) => n.id === prev)) return prev;
        return json.notes[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Companies + projects for the "Add to project" dropdown
  useEffect(() => {
    (async () => {
      const cRes = await fetch("/api/companies");
      if (!cRes.ok) return;
      const cJson = (await cRes.json()) as { companies: { id: string; name: string }[] };
      const result = await Promise.all(cJson.companies.map(async (c) => {
        const pRes = await fetch(`/api/projects?companyId=${c.id}`);
        if (!pRes.ok) return { ...c, projects: [] };
        const pJson = (await pRes.json()) as { projects: { id: string; name: string }[] };
        return { ...c, projects: pJson.projects };
      }));
      setCompaniesWithProjects(result);
    })();
  }, []);

  async function createNote() {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "", body: "", meetingDate: iso }),
    });
    if (res.ok) {
      const created = (await res.json()) as Note;
      setNotes((prev) => prev ? [created, ...prev] : [created]);
      setSelectedId(created.id);
    }
  }

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setNotes((prev) => prev?.filter((n) => n.id !== id) ?? null);
      setSelectedId((prev) => {
        if (prev !== id) return prev;
        const remaining = (notes ?? []).filter((n) => n.id !== id);
        return remaining[0]?.id ?? null;
      });
    }
  }

  function patchLocal(id: string, patch: Partial<Note>) {
    setNotes((prev) => prev?.map((n) => n.id === id ? { ...n, ...patch } : n) ?? null);
  }

  const filtered = useMemo(() => {
    if (!notes) return null;
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (q && !(n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))) return false;
      if (activeTagIds.size > 0) {
        const ids = n.tagIds ?? [];
        for (const id of activeTagIds) {
          if (!ids.includes(id)) return false;
        }
      }
      return true;
    });
  }, [notes, search, activeTagIds]);

  const allTagIdsInScope = useMemo(() => {
    const s = new Set<string>();
    for (const n of notes ?? []) for (const id of n.tagIds ?? []) s.add(id);
    return s;
  }, [notes]);

  const selected = useMemo(
    () => notes?.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  );

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `${listOpen ? "300px" : "44px"} minmax(0, 1fr) ${tasksOpen ? "320px" : "44px"}`,
      height: "100vh",
      background: "var(--bg-page)",
      transition: "grid-template-columns 180ms var(--ease-apple)",
    }}>
      {/* List panel */}
      {!listOpen ? (
        <CollapsedRail side="left" label="Notes" onExpand={() => setListOpen(true)} />
      ) : (
      <aside style={{
        borderRight: "1px solid var(--color-border)",
        background: "var(--bg-card)",
        display: "flex", flexDirection: "column",
        minWidth: 0,
      }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <h1 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>Meeting Notes</h1>
            <button
              onClick={() => setListOpen(false)}
              aria-label="Hide notes list"
              title="Hide list"
              style={{
                marginLeft: "auto",
                width: 26, height: 26, borderRadius: 7,
                background: "transparent", color: "var(--color-text-tertiary)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,6 9,12 15,18" /></svg>
            </button>
            <button
              onClick={createNote}
              aria-label="New note"
              style={{
                width: 30, height: 30, borderRadius: 9,
                background: "var(--color-accent)", color: "white",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, lineHeight: 1,
              }}
            >+</button>
          </div>
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "7px 11px",
              borderRadius: 9, border: "1px solid var(--color-border)",
              fontSize: 13, fontFamily: "inherit",
              background: "var(--bg-page)", outline: "none",
            }}
          />
          {allTagIdsInScope.size > 0 && (
            <FilterButton
              allTagIds={allTagIdsInScope}
              active={activeTagIds}
              onChange={setActiveTagIds}
            />
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
          {error && (
            <div style={{ margin: "8px 10px", padding: 10, background: "#FEE2E2", color: "#991B1B", borderRadius: 10, fontSize: 12 }}>
              {error}
            </div>
          )}
          {filtered && filtered.length === 0 && !error && (
            <div style={{ padding: "30px 16px", textAlign: "center", fontSize: 13, color: "var(--color-text-tertiary)" }}>
              {search ? "No matching notes." : "No notes yet. Click + to start."}
            </div>
          )}
          {filtered && filtered.map((n) => (
            <NoteListItem
              key={n.id}
              note={n}
              selected={selectedId === n.id}
              onSelect={() => setSelectedId(n.id)}
            />
          ))}
        </div>
      </aside>
      )}

      {/* Editor panel */}
      <main style={{ minWidth: 0, overflowY: "auto" }}>
        {!selected && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", color: "var(--color-text-tertiary)", fontSize: 14,
          }}>
            {notes === null ? "Loading…" : "Select a note or click + to create one."}
          </div>
        )}
        {selected && (
          <NoteEditor
            key={selected.id}
            note={selected}
            onChange={(patch) => patchLocal(selected.id, patch)}
            onDelete={() => deleteNote(selected.id)}
          />
        )}
      </main>

      {/* Tasks rail */}
      {!tasksOpen ? (
        <CollapsedRail side="right" label="Tasks" onExpand={() => setTasksOpen(true)} />
      ) : (
        <aside style={{
          borderLeft: "1px solid var(--color-border)",
          background: "var(--bg-card)",
          display: "flex", flexDirection: "column",
          minWidth: 0,
        }}>
          {selected ? (
            <TasksRail noteId={selected.id} companies={companiesWithProjects} onCollapse={() => setTasksOpen(false)} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", padding: "20px 16px 10px" }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Tasks</h2>
              <button
                onClick={() => setTasksOpen(false)}
                aria-label="Hide tasks"
                title="Hide tasks"
                style={{
                  marginLeft: "auto",
                  width: 26, height: 26, borderRadius: 7,
                  background: "transparent", color: "var(--color-text-tertiary)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9,6 15,12 9,18" /></svg>
              </button>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function CollapsedRail({ side, label, onExpand }: { side: "left" | "right"; label: string; onExpand: () => void }) {
  return (
    <aside style={{
      [side === "left" ? "borderRight" : "borderLeft"]: "1px solid var(--color-border)",
      background: "var(--bg-card)",
      display: "flex", flexDirection: "column", alignItems: "center",
      paddingTop: 18, gap: 12,
    } as React.CSSProperties}>
      <button
        onClick={onExpand}
        aria-label={`Show ${label}`}
        title={`Show ${label}`}
        style={{
          width: 28, height: 28, borderRadius: 8,
          background: "transparent", color: "var(--color-text-secondary)",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {side === "left"
            ? <polyline points="9,6 15,12 9,18" />
            : <polyline points="15,6 9,12 15,18" />}
        </svg>
      </button>
      <div style={{
        writingMode: "vertical-rl",
        transform: "rotate(180deg)",
        fontSize: 11, fontWeight: 600,
        color: "var(--color-text-tertiary)",
        textTransform: "uppercase",
        letterSpacing: 1,
      }}>{label}</div>
    </aside>
  );
}

function plainTextSnippet(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ").trim();
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").trim();
}

function FilterButton({
  allTagIds, active, onChange,
}: {
  allTagIds: Set<string>;
  active: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const count = active.size;
  return (
    <div ref={ref} style={{ position: "relative", marginTop: 8 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 8,
          border: "1px solid var(--color-border)",
          background: count > 0 ? "rgba(0,113,227,0.08)" : "transparent",
          color: count > 0 ? "var(--color-accent)" : "var(--color-text-secondary)",
          fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        Filter{count > 0 ? ` (${count})` : ""}
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30,
            background: "white", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 12, minWidth: 240, border: "1px solid var(--color-border)",
          }}
        >
          <TagFilterChips allTagIds={allTagIds} active={active} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

function NoteListItem({
  note, selected, onSelect,
}: {
  note: Note;
  selected: boolean;
  onSelect: () => void;
}) {
  const allTags = useTags();
  return (
    <button
      onClick={onSelect}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "10px 12px", marginBottom: 2,
        borderRadius: 10, border: "none", cursor: "pointer",
        background: selected ? "rgba(0,113,227,0.1)" : "transparent",
        fontFamily: "inherit",
        transition: "background 100ms var(--ease-apple)",
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "rgba(0,0,0,0.035)"; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{
        fontSize: 14, fontWeight: 600, marginBottom: 2,
        color: selected ? "var(--color-accent)" : "var(--color-text-primary)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {note.title || "Untitled"}
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 4 }}>
        {formatListDate(note.meetingDate ?? note.updatedAt)}
      </div>
      <div style={{
        fontSize: 12, color: "var(--color-text-secondary)",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        overflow: "hidden", lineHeight: 1.4,
      }}>
        {plainTextSnippet(note.body) || <span style={{ fontStyle: "italic" }}>No content yet.</span>}
      </div>
      {note.tagIds && note.tagIds.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <TagPillList tagIds={note.tagIds} allTags={allTags} max={4} size="xs" />
        </div>
      )}
    </button>
  );
}

function formatListDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - dd.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 0 && diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

/* ─── Editor ─── */

function NoteEditor({
  note, onChange, onDelete,
}: {
  note: Note;
  onChange: (patch: Partial<Note>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [meetingDate, setMeetingDate] = useState(note.meetingDate ?? "");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const titleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodySaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Map of taskId → checked, last seen in the doc
  const taskSyncRef = useRef<Map<string, boolean>>(new Map());
  // Ref to the live editor so async drop/paste handlers can insert via the editor API
  const editorRef = useRef<Editor | null>(null);

  function notifyTaskAdded() {
    window.dispatchEvent(new CustomEvent("note-task-changed", { detail: { noteId: note.id } }));
  }

  async function uploadFile(file: File): Promise<string | null> {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("noteId", note.id);
      const res = await fetch("/api/notes/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { url: string };
      return json.url;
    } catch (e) {
      alert("Upload failed: " + (e instanceof Error ? e.message : "unknown"));
      return null;
    }
  }

  async function uploadAndInsertImage(editor: Editor) {
    fileInputRef.current?.click();
    const handler = async () => {
      const file = fileInputRef.current?.files?.[0];
      if (!file) return;
      const url = await uploadFile(file);
      if (url) editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    fileInputRef.current!.onchange = handler;
  }

  const editor = useEditor({
    editorProps: {
      handleDrop(view, event) {
        const dragEvent = event as DragEvent;
        const files = dragEvent.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
        if (imageFiles.length === 0) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: dragEvent.clientX, top: dragEvent.clientY });
        const insertPos = coords?.pos ?? view.state.selection.from;
        (async () => {
          for (const file of imageFiles) {
            const url = await uploadFile(file);
            if (!url) continue;
            const ed = editorRef.current;
            if (!ed) return;
            ed.chain().focus().insertContentAt(insertPos, {
              type: "image",
              attrs: { src: url, alt: file.name },
            }).run();
          }
        })();
        return true;
      },
      handlePaste(_view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        const imageItems = Array.from(items).filter((i) => i.type.startsWith("image/"));
        if (imageItems.length === 0) return false;
        event.preventDefault();
        (async () => {
          for (const item of imageItems) {
            const file = item.getAsFile();
            if (!file) continue;
            const url = await uploadFile(file);
            if (!url) continue;
            const ed = editorRef.current;
            if (!ed) return;
            ed.chain().focus().setImage({ src: url, alt: file.name || "pasted-image" }).run();
          }
        })();
        return true;
      },
    },
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      ResizableImageExtension,
      TaskList,
      LinkedTaskItem.configure({ nested: true }),
      UserMention,
      Placeholder.configure({ placeholder: "Type ‘/’ for blocks · ‘@’ to mention · start your meeting notes…" }),
      createSlashCommand({
        onPickTodo: async (taskTitle) => {
          const res = await fetch(`/api/notes/${note.id}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: taskTitle }),
          });
          if (!res.ok) return null;
          const created = (await res.json()) as { id: string };
          notifyTaskAdded();
          // record the new task in the sync ref so the editor's onUpdate
          // doesn't see this insertion as a "new task to PATCH"
          taskSyncRef.current.set(created.id, false);
          return { id: created.id };
        },
        onPickImage: () => {
          if (editor) uploadAndInsertImage(editor);
        },
      }),
    ],
    content: note.body || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (bodySaveTimer.current) clearTimeout(bodySaveTimer.current);
      bodySaveTimer.current = setTimeout(async () => {
        const res = await fetch(`/api/notes/${note.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: html }),
        });
        if (res.ok) {
          setSavedAt(new Date());
          onChange({ body: html });
        }
      }, 500);

      // Sync linked tasks: detect deletions and check-toggles inline
      const current = scanLinkedTasks(editor);
      const prev = taskSyncRef.current;
      const deletions: string[] = [];
      const toggles: { id: string; checked: boolean }[] = [];
      for (const [id] of prev) {
        if (!current.has(id)) deletions.push(id);
      }
      for (const [id, checked] of current) {
        if (prev.has(id) && prev.get(id) !== checked) toggles.push({ id, checked });
      }
      taskSyncRef.current = current;
      if (deletions.length === 0 && toggles.length === 0) return;
      (async () => {
        await Promise.all([
          ...deletions.map((id) => fetch(`/api/notes/${note.id}/tasks/${id}`, { method: "DELETE" })),
          ...toggles.map((t) => fetch(`/api/notes/${note.id}/tasks/${t.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed: t.checked }),
          })),
        ]).catch(() => {});
        notifyTaskAdded();
      })();
    },
  });

  // Keep editorRef in sync so the drop/paste handlers can use the live instance
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Initial scan once the editor is mounted with this note's content
  useEffect(() => {
    if (!editor) return;
    taskSyncRef.current = scanLinkedTasks(editor);
  }, [editor, note.id]);

  // React to rail-side changes (delete / toggle) by mutating the editor doc
  useEffect(() => {
    if (!editor) return;
    function onRailDeleted(e: Event) {
      const ev = e as CustomEvent<{ noteId: string; taskId: string }>;
      if (!editor || ev.detail?.noteId !== note.id) return;
      const pos = findTaskItemPos(editor, ev.detail.taskId);
      if (pos == null) return;
      const $pos = editor.state.doc.resolve(pos);
      const node = $pos.nodeAfter;
      if (!node) return;
      // Update sync ref BEFORE the edit so onUpdate doesn't try to re-delete via API
      taskSyncRef.current.delete(ev.detail.taskId);
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
    }
    function onRailToggled(e: Event) {
      const ev = e as CustomEvent<{ noteId: string; taskId: string; completed: boolean }>;
      if (!editor || ev.detail?.noteId !== note.id) return;
      const pos = findTaskItemPos(editor, ev.detail.taskId);
      if (pos == null) return;
      // Update sync ref before the edit
      taskSyncRef.current.set(ev.detail.taskId, ev.detail.completed);
      editor.chain().command(({ tr }) => {
        tr.setNodeMarkup(pos, undefined, { ...editor.state.doc.nodeAt(pos)?.attrs, checked: ev.detail.completed });
        return true;
      }).run();
    }
    window.addEventListener("rail-task-deleted", onRailDeleted);
    window.addEventListener("rail-task-toggled", onRailToggled);
    return () => {
      window.removeEventListener("rail-task-deleted", onRailDeleted);
      window.removeEventListener("rail-task-toggled", onRailToggled);
    };
  }, [editor, note.id]);

  function saveTitle(v: string) {
    setTitle(v);
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: v }),
      });
      if (res.ok) {
        setSavedAt(new Date());
        onChange({ title: v });
      }
    }, 500);
  }

  function saveDate(v: string) {
    setMeetingDate(v);
    fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingDate: v || null }),
    }).then(() => {
      setSavedAt(new Date());
      onChange({ meetingDate: v || null });
    });
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "36px 56px 80px" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
      />

      <div style={{ display: "flex", alignItems: "center", marginBottom: 14, gap: 10 }}>
        <input
          type="date"
          value={meetingDate}
          onChange={(e) => saveDate(e.target.value)}
          style={{
            padding: "5px 10px",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            fontSize: 12, fontFamily: "inherit",
            color: "var(--color-text-secondary)",
            background: "transparent",
            outline: "none",
          }}
        />
        <NoteAccessControl note={note} onChange={onChange} />
        <NoteTagsControl note={note} onChange={onChange} />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
          {savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Auto-saves"}
        </span>
        <button
          onClick={onDelete}
          style={{
            padding: "5px 12px",
            border: "1px solid #FCA5A5", color: "#B91C1C",
            borderRadius: 8, background: "transparent",
            fontSize: 12, fontWeight: 500, cursor: "pointer",
            fontFamily: "inherit",
          }}
        >Delete</button>
      </div>

      <input
        autoFocus
        value={title}
        onChange={(e) => saveTitle(e.target.value)}
        placeholder="Untitled meeting"
        style={{
          width: "100%",
          fontSize: 32, fontWeight: 700,
          border: "none", outline: "none",
          background: "transparent",
          color: "var(--color-text-primary)",
          padding: "4px 0", marginBottom: 14,
          fontFamily: "inherit",
        }}
      />

      {editor && <Toolbar editor={editor} onPickImage={() => uploadAndInsertImage(editor)} />}

      <div className="tiptap-wrap">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function NoteAccessControl({ note, onChange }: { note: Note; onChange: (patch: Partial<Note>) => void }) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<{ email: string; label: string }[]>([]);
  const [accessUsers, setAccessUsers] = useState<string[]>(note.accessUsers ?? []);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setAccessUsers(note.accessUsers ?? []); }, [note.id, note.accessUsers]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/users", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { users?: { email: string; label: string }[] } | null) => {
        if (j?.users) setUsers(j.users);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function setMode(mode: "everyone" | "restricted") {
    setSaving(true);
    try {
      await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessMode: mode,
          ...(mode === "restricted" ? { setAccessUsers: accessUsers } : {}),
        }),
      });
      onChange({ accessMode: mode, accessUsers: mode === "restricted" ? accessUsers : [] });
    } finally { setSaving(false); }
  }

  async function toggleUser(email: string) {
    const next = accessUsers.includes(email) ? accessUsers.filter((e) => e !== email) : [...accessUsers, email];
    setAccessUsers(next);
    await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessMode: "restricted", setAccessUsers: next }),
    });
    onChange({ accessMode: "restricted", accessUsers: next });
  }

  const isRestricted = note.accessMode === "restricted";
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 8,
          border: "1px solid var(--color-border)",
          background: isRestricted ? "#FFF8E7" : "#D1FAE5",
          color: isRestricted ? "#92400E" : "#065F46",
          fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}
        title={isRestricted ? `Restricted to ${accessUsers.length} ${accessUsers.length === 1 ? "person" : "people"}` : "Visible to everyone in the workspace"}
      >
        {isRestricted ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" />
            <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          </svg>
        )}
        {isRestricted ? `Restricted (${accessUsers.length})` : "Everyone"}
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30,
            background: "white", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 14, minWidth: 280, border: "1px solid var(--color-border)",
          }}
        >
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button
              onClick={() => setMode("everyone")}
              style={{
                flex: 1, padding: "7px 10px", borderRadius: 8,
                border: `1px solid ${!isRestricted ? "var(--color-accent)" : "var(--color-border)"}`,
                background: !isRestricted ? "rgba(0,113,227,0.08)" : "transparent",
                color: !isRestricted ? "#0071E3" : "var(--color-text-primary)",
                fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}
            >Everyone</button>
            <button
              onClick={() => setMode("restricted")}
              style={{
                flex: 1, padding: "7px 10px", borderRadius: 8,
                border: `1px solid ${isRestricted ? "var(--color-accent)" : "var(--color-border)"}`,
                background: isRestricted ? "rgba(0,113,227,0.08)" : "transparent",
                color: isRestricted ? "#0071E3" : "var(--color-text-primary)",
                fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}
            >Restricted</button>
          </div>

          {isRestricted ? (
            <>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 6 }}>
                Pick who can see this note (the author always can):
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" }}>
                {users.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>Loading…</div>
                )}
                {users.map((u) => {
                  const checked = accessUsers.includes(u.email);
                  const isAuthor = u.email === note.authorEmail;
                  return (
                    <label
                      key={u.email}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 8px", borderRadius: 6,
                        cursor: isAuthor ? "default" : "pointer",
                        opacity: isAuthor ? 0.6 : 1,
                        fontSize: 12,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked || isAuthor}
                        onChange={() => !isAuthor && toggleUser(u.email)}
                        disabled={isAuthor}
                      />
                      {u.label} <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>{isAuthor ? "(author)" : ""}</span>
                    </label>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Visible to everyone with workspace access.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NoteTagsControl({ note, onChange }: { note: Note; onChange: (patch: Partial<Note>) => void }) {
  const allTags = useTags();
  const [open, setOpen] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>(note.tagIds ?? []);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setTagIds(note.tagIds ?? []); }, [note.id, note.tagIds]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function setSelection(next: string[]) {
    setTagIds(next);
    onChange({ tagIds: next });
    await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setTagIds: next }),
    });
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 8,
          border: "1px solid var(--color-border)",
          background: "transparent",
          color: "var(--color-text-secondary)",
          fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        }}
        title="Tag this note"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
        {tagIds.length > 0 ? (
          <TagPillList tagIds={tagIds} allTags={allTags} max={3} size="xs" />
        ) : (
          <span>Tags</span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30,
            background: "white", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 14, minWidth: 320, border: "1px solid var(--color-border)",
          }}
        >
          <TagPicker selected={tagIds} onChange={setSelection} />
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor, onPickImage }: { editor: Editor; onPickImage: () => void }) {
  const btn = (active: boolean, onClick: () => void, label: string) => (
    <button
      key={label}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={{
        padding: "5px 9px",
        background: active ? "rgba(0,113,227,0.1)" : "transparent",
        color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
        border: "none", borderRadius: 7, cursor: "pointer",
        fontFamily: "inherit", fontSize: 12, fontWeight: 500,
      }}
    >{label}</button>
  );
  return (
    <div style={{
      display: "flex", gap: 2, marginBottom: 10,
      padding: 4, borderRadius: 10,
      background: "rgba(0,0,0,0.03)",
      flexWrap: "wrap",
    }}>
      {btn(editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), "H1")}
      {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "H2")}
      {btn(editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "H3")}
      <span style={{ width: 1, background: "var(--color-border)", margin: "0 4px" }} />
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Bold")}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Italic")}
      {btn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), "Underline")}
      {btn(editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), "Strike")}
      <span style={{ width: 1, background: "var(--color-border)", margin: "0 4px" }} />
      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "• List")}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "1. List")}
      {btn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "Quote")}
      {btn(editor.isActive("codeBlock"), () => editor.chain().focus().toggleCodeBlock().run(), "Code")}
      <span style={{ width: 1, background: "var(--color-border)", margin: "0 4px" }} />
      {btn(false, onPickImage, "Image")}
    </div>
  );
}

/* ─── Tasks rail ─── */

function TasksRail({ noteId, companies, onCollapse }: { noteId: string; companies: CompanyWithProjects[]; onCollapse: () => void }) {
  const [tasks, setTasks] = useState<NoteTask[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/notes/${noteId}/tasks`, { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as { tasks: NoteTask[] };
      setTasks(json.tasks);
    }
  }, [noteId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Listen for editor-side changes (slash command, deletion, check toggle)
  useEffect(() => {
    function onChanged(e: Event) {
      const ev = e as CustomEvent<{ noteId: string }>;
      if (ev.detail?.noteId === noteId) refresh();
    }
    window.addEventListener("note-task-changed", onChanged);
    return () => window.removeEventListener("note-task-changed", onChanged);
  }, [noteId, refresh]);

  async function addTask() {
    const t = newTitle.trim();
    if (!t) return;
    const res = await fetch(`/api/notes/${noteId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t }),
    });
    if (res.ok) {
      setNewTitle("");
      setAdding(false);
      refresh();
    }
  }

  async function toggleComplete(task: NoteTask) {
    const newCompleted = !task.completed;
    const res = await fetch(`/api/notes/${noteId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: newCompleted }),
    });
    if (res.ok) {
      window.dispatchEvent(new CustomEvent("rail-task-toggled", {
        detail: { noteId, taskId: task.id, completed: newCompleted },
      }));
      refresh();
    }
  }

  async function deleteTask(task: NoteTask) {
    const res = await fetch(`/api/notes/${noteId}/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) {
      window.dispatchEvent(new CustomEvent("rail-task-deleted", {
        detail: { noteId, taskId: task.id },
      }));
      refresh();
    }
  }

  async function promote(task: NoteTask, projectId: string) {
    const res = await fetch(`/api/notes/${noteId}/tasks/${task.id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    if (res.ok) refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ padding: "20px 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Tasks</h2>
          <button
            onClick={onCollapse}
            aria-label="Hide tasks"
            title="Hide tasks"
            style={{
              marginLeft: "auto",
              width: 24, height: 24, borderRadius: 7,
              background: "transparent", color: "var(--color-text-tertiary)",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9,6 15,12 9,18" /></svg>
          </button>
          <button
            onClick={() => setAdding(true)}
            style={{
              padding: "3px 9px",
              background: "rgba(0,113,227,0.1)", color: "var(--color-accent)",
              border: "none", borderRadius: 7, cursor: "pointer",
              fontSize: 11, fontWeight: 600, fontFamily: "inherit",
            }}
          >+ Add</button>
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
          Type / in the note to add fast.
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 16px" }}>
        {adding && (
          <div style={{ padding: 8, marginBottom: 8, background: "rgba(0,113,227,0.06)", borderRadius: 10 }}>
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask();
                if (e.key === "Escape") { setAdding(false); setNewTitle(""); }
              }}
              placeholder="Task title…"
              style={{
                width: "100%", padding: "6px 9px",
                border: "1px solid var(--color-border)", borderRadius: 7,
                fontSize: 12, fontFamily: "inherit", outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button
                onClick={addTask}
                style={{
                  padding: "4px 10px", background: "var(--color-accent)", color: "white",
                  border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >Add</button>
              <button
                onClick={() => { setAdding(false); setNewTitle(""); }}
                style={{
                  padding: "4px 10px", background: "transparent",
                  color: "var(--color-text-secondary)", border: "1px solid var(--color-border)",
                  borderRadius: 6, fontSize: 11, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >Cancel</button>
            </div>
          </div>
        )}

        {tasks === null && (
          <div style={{ padding: 12, fontSize: 12, color: "var(--color-text-tertiary)" }}>Loading…</div>
        )}
        {tasks && tasks.length === 0 && !adding && (
          <div style={{ padding: "20px 8px", fontSize: 12, color: "var(--color-text-tertiary)", fontStyle: "italic", textAlign: "center" }}>
            No tasks yet. Type / in the note or click + Add.
          </div>
        )}
        {tasks && tasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            companies={companies}
            onToggle={() => toggleComplete(t)}
            onDelete={() => deleteTask(t)}
            onAssign={(projectId) => promote(t, projectId)}
          />
        ))}
      </div>
    </div>
  );
}

function TaskRow({
  task, companies, onToggle, onDelete, onAssign,
}: {
  task: NoteTask;
  companies: CompanyWithProjects[];
  onToggle: () => void;
  onDelete: () => void;
  onAssign: (projectId: string) => void;
}) {
  const projectName = useMemo(() => {
    if (!task.projectId) return null;
    for (const c of companies) {
      const p = c.projects.find((p) => p.id === task.projectId);
      if (p) return `${c.name} › ${p.name}`;
    }
    return null;
  }, [task.projectId, companies]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 6,
      padding: "9px 10px", marginBottom: 4,
      background: "var(--bg-page)", borderRadius: 10,
      border: "1px solid var(--color-border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={onToggle}
          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
          style={{
            width: 16, height: 16, borderRadius: "50%",
            border: `1.5px solid ${task.completed ? "#10B981" : "var(--color-text-tertiary)"}`,
            background: task.completed ? "#10B981" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0, flexShrink: 0,
          }}
        >
          {task.completed && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="5,12 10,17 19,7" /></svg>}
        </button>
        <span style={{
          flex: 1, fontSize: 12, minWidth: 0,
          color: task.completed ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
          textDecoration: task.completed ? "line-through" : "none",
          wordBreak: "break-word",
        }}>
          {task.title}
        </span>
        <button
          onClick={onDelete}
          aria-label="Delete"
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--color-text-tertiary)", padding: 2,
            display: "flex", alignItems: "center",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="6" y1="18" x2="18" y2="6" />
          </svg>
        </button>
      </div>
      {projectName ? (
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
          → {projectName}
        </div>
      ) : (
        <select
          value=""
          onChange={(e) => { if (e.target.value) onAssign(e.target.value); }}
          style={{
            padding: "3px 7px",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            fontSize: 11, fontFamily: "inherit",
            background: "transparent",
            color: "var(--color-text-secondary)",
            cursor: "pointer",
          }}
        >
          <option value="">Add to project…</option>
          {companies.map((c) => (
            <optgroup key={c.id} label={c.name}>
              {c.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
    </div>
  );
}
