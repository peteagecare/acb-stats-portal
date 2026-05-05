"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { ResizableImageExtension } from "../notes/_image";
import "../notes/notes.css";

export function RichNoteEditor({
  content,
  placeholder,
  onChange,
}: {
  content: string;
  placeholder?: string;
  onChange: (html: string) => void;
}) {
  const lastEmitted = useRef(content);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
      ResizableImageExtension,
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html === lastEmitted.current) return;
      lastEmitted.current = html;
      onChange(html);
    },
  });

  // Sync external content changes (e.g. initial load after fetch)
  useEffect(() => {
    if (!editor) return;
    if (content === lastEmitted.current) return;
    lastEmitted.current = content;
    editor.commands.setContent(content || "", { emitUpdate: false });
  }, [content, editor]);

  return (
    <div className="tiptap-wrap">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  function btn(active: boolean, onClick: () => void, label: string, key?: string) {
    return (
      <button
        key={key ?? label}
        type="button"
        onClick={onClick}
        style={{
          padding: "6px 10px",
          fontSize: 12,
          fontWeight: active ? 600 : 500,
          background: active ? "rgba(0,113,227,0.1)" : "transparent",
          border: "none",
          borderRadius: 6,
          color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {label}
      </button>
    );
  }

  function uploadImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/attachments", { method: "POST", body: fd });
      if (res.ok) {
        const data = (await res.json()) as { url?: string };
        if (data.url) editor.chain().focus().setImage({ src: data.url }).run();
      }
    };
    input.click();
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        padding: "6px 8px",
        background: "rgba(0,0,0,0.04)",
        borderRadius: 8,
        marginBottom: 12,
      }}
    >
      {btn(editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), "H1")}
      {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "H2")}
      {btn(editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "H3")}
      <span style={{ width: 1, background: "rgba(0,0,0,0.08)", margin: "0 4px" }} />
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Bold")}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Italic")}
      {btn(editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), "Strike")}
      <span style={{ width: 1, background: "rgba(0,0,0,0.08)", margin: "0 4px" }} />
      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "• List")}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "1. List")}
      {btn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "Quote")}
      {btn(editor.isActive("codeBlock"), () => editor.chain().focus().toggleCodeBlock().run(), "Code")}
      <span style={{ width: 1, background: "rgba(0,0,0,0.08)", margin: "0 4px" }} />
      {btn(false, uploadImage, "Image")}
    </div>
  );
}
