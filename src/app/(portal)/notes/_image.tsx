"use client";

import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function ResizableImage(props: NodeViewProps) {
  const { node, updateAttributes, selected } = props;
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const width = node.attrs.width as string | null;
  const showHandles = selected || hovered;

  function startResize(corner: "br" | "bl") {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const img = wrapper.querySelector("img");
      if (!img) return;
      const startX = e.clientX;
      const startWidth = img.getBoundingClientRect().width;
      const containerWidth = wrapper.parentElement?.getBoundingClientRect().width ?? 1000;
      const dir = corner === "br" ? 1 : -1;

      function onMove(ev: MouseEvent) {
        const delta = (ev.clientX - startX) * dir;
        const newWidth = Math.max(80, Math.min(containerWidth, startWidth + delta));
        updateAttributes({ width: `${Math.round(newWidth)}px` });
      }
      function onUp() {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
  }

  function presetWidth(value: string | null) {
    updateAttributes({ width: value });
  }

  return (
    <NodeViewWrapper as="div" style={{ margin: "8px 0" }}>
      <span
        ref={wrapperRef}
        style={{
          position: "relative", display: "inline-block",
          maxWidth: "100%", lineHeight: 0,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <img
          src={node.attrs.src}
          alt={node.attrs.alt ?? ""}
          draggable={false}
          style={{
            display: "block",
            width: width ?? "auto",
            maxWidth: "100%",
            borderRadius: 10,
            outline: selected ? "2px solid var(--color-accent)" : "2px solid transparent",
            outlineOffset: 1,
          }}
        />
        {showHandles && (
          <>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightbox(true); }}
              aria-label="Open full screen"
              title="Open full screen"
              style={{
                position: "absolute", top: 6, right: 6,
                width: 28, height: 28, borderRadius: 8,
                background: "rgba(0,0,0,0.55)", color: "white",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 1px 6px rgba(0,0,0,0.3)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15,3 21,3 21,9" />
                <polyline points="9,21 3,21 3,15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
            <span
              onMouseDown={startResize("bl")}
              style={{
                position: "absolute", left: -4, bottom: -4,
                width: 12, height: 12, borderRadius: 3,
                background: "var(--color-accent)",
                border: "2px solid white",
                boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                cursor: "nesw-resize",
              }}
            />
            <span
              onMouseDown={startResize("br")}
              style={{
                position: "absolute", right: -4, bottom: -4,
                width: 12, height: 12, borderRadius: 3,
                background: "var(--color-accent)",
                border: "2px solid white",
                boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                cursor: "nwse-resize",
              }}
            />
            <span
              style={{
                position: "absolute", left: "50%", bottom: -34,
                transform: "translateX(-50%)",
                display: "inline-flex", gap: 2,
                background: "white",
                border: "1px solid var(--color-border)",
                borderRadius: 8, padding: 2,
                boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
              contentEditable={false}
            >
              {[
                { label: "S", value: "240px" },
                { label: "M", value: "440px" },
                { label: "L", value: "640px" },
                { label: "Full", value: null },
              ].map((p) => (
                <button
                  key={p.label}
                  onMouseDown={(e) => { e.preventDefault(); presetWidth(p.value); }}
                  style={{
                    padding: "3px 8px",
                    background: width === p.value || (!width && p.value === null)
                      ? "rgba(0,113,227,0.1)" : "transparent",
                    color: width === p.value || (!width && p.value === null)
                      ? "var(--color-accent)" : "var(--color-text-secondary)",
                    border: "none", borderRadius: 5,
                    fontSize: 11, fontWeight: 500, fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >{p.label}</button>
              ))}
            </span>
          </>
        )}
      </span>
      {lightbox && <Lightbox src={node.attrs.src} alt={node.attrs.alt ?? ""} onClose={() => setLightbox(false)} />}
    </NodeViewWrapper>
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 32,
        cursor: "zoom-out",
      }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
        style={{
          position: "absolute", top: 16, right: 16,
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(255,255,255,0.12)", color: "white",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(8px)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "100%", maxHeight: "100%",
          borderRadius: 12,
          boxShadow: "0 12px 60px rgba(0,0,0,0.5)",
          cursor: "default",
        }}
      />
    </div>,
    document.body,
  );
}

export const ResizableImageExtension = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute("width") || el.style.width || null,
        renderHTML: (attrs) => {
          if (!attrs.width) return {};
          return { width: attrs.width, style: `width: ${attrs.width}` };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImage);
  },
});
