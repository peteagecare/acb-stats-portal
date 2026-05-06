"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Avatar,
  DirectoryUser,
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  userMeta,
} from "./_shared";
import { CommentMention } from "./_comment-mention";
import "../notes/notes.css";

export type ParentType = "project" | "task";

function commentBodyIsHtml(body: string): boolean {
  return /^\s*<(p|ul|ol|h[1-6]|blockquote|pre|div|span)\b/i.test(body);
}

/* ─────────────────────────────────── */
/* Comments                            */
/* ─────────────────────────────────── */

interface Comment {
  id: string;
  parentType: ParentType;
  parentId: string;
  body: string;
  authorEmail: string;
  createdAt: string;
  editedAt: string | null;
}

export function Comments({
  parentType, parentId, users, currentEmail,
}: {
  parentType: ParentType;
  parentId: string;
  users: DirectoryUser[];
  currentEmail: string | null;
}) {
  const [list, setList] = useState<Comment[] | null>(null);
  const [posting, setPosting] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Add a comment… (use @ to mention)" }),
      CommentMention,
    ],
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "comment-editor",
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          submitRef.current?.();
          return true;
        }
        return false;
      },
    },
  });

  const refresh = useCallback(async () => {
    const res = await fetch(
      `/api/comments?parentType=${parentType}&parentId=${parentId}`,
      { cache: "no-store" },
    );
    if (!res.ok) return;
    const json = (await res.json()) as { comments: Comment[] };
    setList(json.comments);
  }, [parentType, parentId]);

  useEffect(() => { refresh(); }, [refresh]);

  const submitRef = useRef<(() => void) | null>(null);
  async function submit() {
    if (!editor) return;
    if (editor.isEmpty) return;
    const html = editor.getHTML();
    setPosting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentType, parentId, body: html }),
      });
      if (res.ok) {
        editor.commands.clearContent();
        await refresh();
      }
    } finally {
      setPosting(false);
    }
  }
  submitRef.current = submit;

  async function deleteComment(id: string) {
    if (!confirm("Delete this comment?")) return;
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) refresh();
  }

  const isEmpty = !editor || editor.isEmpty;

  return (
    <div>
      {list === null && <div style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Loading…</div>}
      {list && list.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--color-text-tertiary)", fontStyle: "italic", marginBottom: 12 }}>
          No comments yet.
        </div>
      )}
      {list && list.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
          {list.map((c) => {
            const author = userMeta(c.authorEmail, users);
            const mine = currentEmail === c.authorEmail;
            return (
              <div key={c.id} style={{ display: "flex", gap: 10 }}>
                <Avatar user={author} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{author?.label ?? c.authorEmail}</span>
                    <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                      {new Date(c.createdAt).toLocaleString()}
                      {c.editedAt && " · edited"}
                    </span>
                    {mine && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--color-text-tertiary)", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  {commentBodyIsHtml(c.body) ? (
                    <div
                      className="comment-body"
                      style={{ fontSize: 13, marginTop: 2, wordBreak: "break-word" }}
                      dangerouslySetInnerHTML={{ __html: c.body }}
                    />
                  ) : (
                    <div style={{ fontSize: 13, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {c.body}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div
          style={{
            ...inputStyle,
            flex: 1,
            minHeight: 60,
            padding: "8px 10px",
            opacity: posting ? 0.6 : 1,
            pointerEvents: posting ? "none" : "auto",
          }}
        >
          <EditorContent editor={editor} />
        </div>
        <button
          onClick={submit}
          disabled={posting || isEmpty}
          style={{ ...primaryButtonStyle, padding: "8px 14px", opacity: posting || isEmpty ? 0.5 : 1 }}
        >
          {posting ? "Posting…" : "Post"}
        </button>
      </div>
      <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 4 }}>
        Type @ to mention someone · ⌘/Ctrl + Enter to post
      </div>
    </div>
  );
}

/* ─────────────────────────────────── */
/* Attachments                         */
/* ─────────────────────────────────── */

interface Attachment {
  id: string;
  parentType: ParentType;
  parentId: string;
  storage: "blob" | "external";
  filename: string;
  url: string;
  blobKey: string | null;
  sizeBytes: number | null;
  contentType: string | null;
  uploadedByEmail: string;
  uploadedAt: string;
}

const MAX_BYTES = 25 * 1024 * 1024;

function fmtBytes(b: number | null) {
  if (b == null) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(name: string, contentType?: string | null) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = contentType?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
  const isPdf = ext === "pdf" || contentType === "application/pdf";
  const isDoc = ["doc", "docx", "txt", "md"].includes(ext);
  const isSheet = ["xls", "xlsx", "csv"].includes(ext);
  const color = isImage ? "#0EA5E9" : isPdf ? "#DC2626" : isDoc ? "#2563EB" : isSheet ? "#16A34A" : "#64748B";
  const label = ext.toUpperCase().slice(0, 4) || "FILE";
  return { color, label };
}

export function Attachments({
  parentType, parentId, users,
}: {
  parentType: ParentType;
  parentId: string;
  users: DirectoryUser[];
}) {
  const [list, setList] = useState<Attachment[] | null>(null);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingExternal, setAddingExternal] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(
      `/api/attachments?parentType=${parentType}&parentId=${parentId}`,
      { cache: "no-store" },
    );
    if (!res.ok) return;
    const json = (await res.json()) as { attachments: Attachment[] };
    setList(json.attachments);
  }, [parentType, parentId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`File too large (max ${fmtBytes(MAX_BYTES)})`);
      return;
    }
    setUploading({ name: file.name, pct: 0 });
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/attachments/upload",
        clientPayload: JSON.stringify({ parentType, parentId }),
        onUploadProgress: (e) => {
          const pct = "percentage" in e ? e.percentage : 0;
          setUploading({ name: file.name, pct: Math.round(pct ?? 0) });
        },
      });
      const res = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentType,
          parentId,
          storage: "blob",
          filename: file.name,
          url: blob.url,
          blobKey: blob.pathname,
          sizeBytes: file.size,
          contentType: file.type || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || `HTTP ${res.status}`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function deleteAttachment(id: string) {
    if (!confirm("Delete this attachment?")) return;
    const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    if (res.ok) refresh();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={!!uploading}
          style={primaryButtonStyle}
        >
          {uploading ? `Uploading ${uploading.pct}%…` : "+ Upload file"}
        </button>
        <input
          ref={fileInput}
          type="file"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <button onClick={() => setAddingExternal(true)} style={secondaryButtonStyle}>
          + Add Google Drive / external link
        </button>
      </div>
      {error && (
        <div style={{ padding: 10, background: "#FEE2E2", color: "#991B1B", borderRadius: 10, fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {addingExternal && (
        <ExternalLinkForm
          onCancel={() => setAddingExternal(false)}
          onSave={async (name, url) => {
            const res = await fetch("/api/attachments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                parentType, parentId,
                storage: "external",
                filename: name,
                url,
              }),
            });
            if (res.ok) { setAddingExternal(false); await refresh(); }
          }}
        />
      )}

      {list === null && <div style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Loading…</div>}
      {list && list.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
          No files attached yet.
        </div>
      )}
      {list && list.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((a) => {
            const ic = fileIcon(a.filename, a.contentType);
            const uploader = userMeta(a.uploadedByEmail, users);
            return (
              <div
                key={a.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 10,
                  background: "white", border: "1px solid var(--color-border)",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: ic.color, color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>
                  {ic.label}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", textDecoration: "none", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {a.filename}
                  </a>
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                    {a.storage === "external" ? "External link" : fmtBytes(a.sizeBytes)} · {uploader?.label ?? a.uploadedByEmail} · {new Date(a.uploadedAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => deleteAttachment(a.id)}
                  style={{ background: "transparent", border: "none", color: "var(--color-text-tertiary)", cursor: "pointer", padding: 4, display: "flex" }}
                  aria-label="Delete attachment"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExternalLinkForm({
  onCancel, onSave,
}: { onCancel: () => void; onSave: (name: string, url: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div style={{
      padding: 12, marginBottom: 14,
      background: "rgba(0,113,227,0.05)", borderRadius: 12,
      border: "1px dashed rgba(0,113,227,0.4)",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto auto", gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Label (e.g. Brief.docx)" style={inputStyle} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/..." style={inputStyle} />
        <button
          onClick={async () => {
            if (!name.trim() || !url.trim()) return;
            if (!/^https?:\/\//i.test(url.trim())) { setErr("URL must start with http:// or https://"); return; }
            setSaving(true); setErr(null);
            try { await onSave(name.trim(), url.trim()); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
            finally { setSaving(false); }
          }}
          disabled={saving || !name.trim() || !url.trim()}
          style={primaryButtonStyle}
        >
          {saving ? "…" : "Add"}
        </button>
        <button onClick={onCancel} style={secondaryButtonStyle}>Cancel</button>
      </div>
      {err && <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 6 }}>{err}</div>}
    </div>
  );
}

/* ─────────────────────────────────── */
/* Project external links              */
/* ─────────────────────────────────── */

interface ProjectLink {
  id: string;
  projectId: string;
  label: string;
  url: string;
  createdAt: string;
  createdByEmail: string;
}

export function ProjectLinks({ projectId }: { projectId: string }) {
  const [list, setList] = useState<ProjectLink[] | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/project-links?projectId=${projectId}`, { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { links: ProjectLink[] };
    setList(json.links);
  }, [projectId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  async function deleteLink(id: string) {
    if (!confirm("Delete this link?")) return;
    const res = await fetch(`/api/project-links/${id}`, { method: "DELETE" });
    if (res.ok) refresh();
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        {!adding ? (
          <button onClick={() => setAdding(true)} style={primaryButtonStyle}>+ Add link</button>
        ) : (
          <ExternalLinkForm
            onCancel={() => setAdding(false)}
            onSave={async (label, url) => {
              const res = await fetch("/api/project-links", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId, label, url }),
              });
              if (res.ok) { setAdding(false); await refresh(); }
            }}
          />
        )}
      </div>

      {list === null && <div style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Loading…</div>}
      {list && list.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
          No links yet.
        </div>
      )}
      {list && list.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((l) => (
            <div key={l.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px", borderRadius: 10,
              background: "white", border: "1px solid var(--color-border)",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: "rgba(0,113,227,0.1)", color: "#0071E3",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={l.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", textDecoration: "none", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {l.label}
                </a>
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {l.url}
                </div>
              </div>
              <button onClick={() => deleteLink(l.id)} style={{ background: "transparent", border: "none", color: "var(--color-text-tertiary)", cursor: "pointer", padding: 4, display: "flex" }} aria-label="Delete link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────── */
/* Project notes (rich text + save)    */
/* ─────────────────────────────────── */

function looksLikeHtml(s: string): boolean {
  return /^\s*<(p|ul|ol|h[1-6]|blockquote|pre|div|span)\b/i.test(s);
}

export function ProjectNotes({
  projectId, initialNotes,
}: {
  projectId: string;
  initialNotes: string | null;
}) {
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Plain-text notes from before the rich-text upgrade need wrapping in <p>
  // so TipTap renders them as a paragraph rather than dropping the content.
  const initialContent =
    initialNotes && initialNotes.trim().length > 0
      ? looksLikeHtml(initialNotes)
        ? initialNotes
        : `<p>${initialNotes.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}</p>`
      : "";

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Placeholder.configure({ placeholder: "Plan, brief, agenda, anything you want kept with the project…" }),
    ],
    content: initialContent,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setDirty(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void save(editor.getHTML());
      }, 600);
    },
  });

  async function save(html: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: html }),
      });
      if (res.ok) {
        setSavedAt(new Date());
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {editor && <NotesToolbar editor={editor} />}
      <div
        className="tiptap-wrap"
        style={{
          ...inputStyle,
          padding: "12px 14px",
          minHeight: 280,
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        <EditorContent editor={editor} />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "var(--color-text-tertiary)" }}>
        {saving
          ? "Saving…"
          : dirty
            ? "Unsaved changes"
            : savedAt
              ? `Saved at ${savedAt.toLocaleTimeString()}`
              : "Auto-saves as you type"}
      </div>
    </div>
  );
}

function NotesToolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean, onClick: () => void, label: string) => (
    <button
      key={label}
      type="button"
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
    </div>
  );
}
