"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import type { LinkOverlay, Overlay } from "@/lib/flipbook/types";
import { embedUrlFor } from "@/lib/flipbook/video";

type Mode = "editor" | "viewer";

type Props = {
  mode: Mode;
  pageAspect: number;
  visiblePage: number;
  overlays: Overlay[];
  hidden?: boolean;
  onUpdate?: (overlay: Overlay) => void;
  onDelete?: (id: string) => void;
  onNavigatePage?: (page: number) => void;
};

type PageBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function computePageBounds(
  stageW: number,
  stageH: number,
  pageAspect: number,
): PageBounds {
  if (stageW <= 0 || stageH <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const stageAspect = stageW / stageH;
  if (stageAspect > pageAspect) {
    const height = stageH;
    const width = height * pageAspect;
    return { left: (stageW - width) / 2, top: 0, width, height };
  }
  const width = stageW;
  const height = width / pageAspect;
  return { left: 0, top: (stageH - height) / 2, width, height };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export default function OverlayLayer({
  mode,
  pageAspect,
  visiblePage,
  overlays,
  hidden = false,
  onUpdate,
  onDelete,
  onNavigatePage,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setStage({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageBounds = useMemo(
    () => computePageBounds(stage.w, stage.h, pageAspect),
    [stage.w, stage.h, pageAspect],
  );

  const visibleOverlays = hidden
    ? []
    : overlays.filter((o) => o.page === visiblePage);

  return (
    <div
      ref={stageRef}
      className="pointer-events-none absolute inset-0 z-20"
    >
      {pageBounds.width > 0
        ? visibleOverlays.map((ovl) => {
            const x = pageBounds.left + ovl.x * pageBounds.width;
            const y = pageBounds.top + ovl.y * pageBounds.height;
            const w = ovl.width * pageBounds.width;
            const h = ovl.height * pageBounds.height;

            if (mode === "viewer") {
              return (
                <ViewerOverlay
                  key={ovl.id}
                  overlay={ovl}
                  x={x}
                  y={y}
                  w={w}
                  h={h}
                  onNavigatePage={onNavigatePage}
                />
              );
            }

            return (
              <EditorOverlay
                key={ovl.id}
                overlay={ovl}
                x={x}
                y={y}
                w={w}
                h={h}
                pageBounds={pageBounds}
                onUpdate={(next) => onUpdate?.(next)}
                onDelete={() => onDelete?.(ovl.id)}
              />
            );
          })
        : null}
    </div>
  );
}

function ViewerOverlay({
  overlay,
  x,
  y,
  w,
  h,
  onNavigatePage,
}: {
  overlay: Overlay;
  x: number;
  y: number;
  w: number;
  h: number;
  onNavigatePage?: (page: number) => void;
}) {
  const style = { left: x, top: y, width: w, height: h };

  if (overlay.type === "video") {
    const src = embedUrlFor(overlay, false);
    return (
      <div
        className="pointer-events-auto absolute overflow-hidden rounded-md shadow-lg"
        style={style}
      >
        <iframe
          src={src}
          title={`${overlay.provider} video`}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="block h-full w-full border-0 bg-black"
        />
      </div>
    );
  }

  if (overlay.type === "gif") {
    return (
      <div
        className="pointer-events-auto absolute overflow-hidden"
        style={style}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={overlay.url}
          alt=""
          className="block h-full w-full object-contain"
          draggable={false}
        />
      </div>
    );
  }

  if (overlay.target.kind === "url") {
    return (
      <a
        href={overlay.target.url}
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto absolute rounded-md transition-colors hover:bg-zinc-900/5"
        style={style}
        title={overlay.target.url}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        onNavigatePage?.(
          overlay.target.kind === "page" ? overlay.target.page : 1,
        )
      }
      className="pointer-events-auto absolute rounded-md transition-colors hover:bg-zinc-900/5"
      style={style}
      title={`Go to page ${overlay.target.kind === "page" ? overlay.target.page : ""}`}
      aria-label={`Go to page ${overlay.target.kind === "page" ? overlay.target.page : ""}`}
    />
  );
}

function EditorOverlay({
  overlay,
  x,
  y,
  w,
  h,
  pageBounds,
  onUpdate,
  onDelete,
}: {
  overlay: Overlay;
  x: number;
  y: number;
  w: number;
  h: number;
  pageBounds: PageBounds;
  onUpdate: (next: Overlay) => void;
  onDelete: () => void;
}) {
  const update = (px: number, py: number, pw: number, ph: number) => {
    if (pageBounds.width <= 0 || pageBounds.height <= 0) return;
    const fx = clamp((px - pageBounds.left) / pageBounds.width, 0, 1);
    const fy = clamp((py - pageBounds.top) / pageBounds.height, 0, 1);
    const fw = clamp(pw / pageBounds.width, 0.02, 1);
    const fh = clamp(ph / pageBounds.height, 0.02, 1);
    onUpdate({ ...overlay, x: fx, y: fy, width: fw, height: fh });
  };

  const borderClass =
    overlay.type === "link"
      ? "border-emerald-500 border-dashed bg-emerald-500/10"
      : overlay.type === "gif"
        ? "border-fuchsia-500 border-dashed"
        : "border-blue-500 bg-blue-500/15";

  const deleteLabel =
    overlay.type === "link"
      ? "Delete link"
      : overlay.type === "gif"
        ? "Delete GIF"
        : "Delete video";

  return (
    <Rnd
      className="pointer-events-auto"
      size={{ width: w, height: h }}
      position={{ x, y }}
      bounds="parent"
      minWidth={48}
      minHeight={32}
      onDragStop={(_e, d) => update(d.x, d.y, w, h)}
      onResizeStop={(_e, _dir, ref, _delta, pos) =>
        update(
          pos.x,
          pos.y,
          parseFloat(ref.style.width),
          parseFloat(ref.style.height),
        )
      }
    >
      <div
        className={`group relative h-full w-full overflow-hidden rounded-md border-2 ${borderClass} backdrop-blur-[2px]`}
      >
        {overlay.type === "gif" ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={overlay.url}
              alt=""
              className="pointer-events-none block h-full w-full object-contain"
              draggable={false}
            />
            <span className="pointer-events-none absolute left-1 top-1 rounded bg-fuchsia-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
              GIF
            </span>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex flex-col items-center gap-1 rounded-md bg-white/95 px-3 py-2 text-xs text-zinc-700 shadow">
              <OverlayBadge overlay={overlay} />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs text-white opacity-0 shadow transition-opacity hover:bg-red-600 group-hover:opacity-100"
          aria-label={deleteLabel}
          title={deleteLabel}
        >
          ✕
        </button>
      </div>
    </Rnd>
  );
}

function OverlayBadge({ overlay }: { overlay: Overlay }) {
  if (overlay.type === "video") {
    return (
      <>
        <div className="flex items-center gap-1.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
          <span className="text-xs font-medium capitalize">
            {overlay.provider}
          </span>
        </div>
        <code className="text-[11px] text-zinc-500">{overlay.videoId}</code>
      </>
    );
  }
  if (overlay.type === "link") {
    return (
      <>
        <div className="flex items-center gap-1.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span className="text-xs font-medium">Link</span>
        </div>
        <code className="max-w-[180px] truncate text-[11px] text-zinc-500">
          {linkSummary(overlay)}
        </code>
      </>
    );
  }
  return null;
}

function linkSummary(overlay: LinkOverlay): string {
  if (overlay.target.kind === "url") return overlay.target.url;
  return `→ Page ${overlay.target.page}`;
}
