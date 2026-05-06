"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LinkTarget,
  Overlay,
  ProjectSettings,
} from "@/lib/flipbook/types";
import type { ParsedVideo } from "@/lib/flipbook/video";
import AddGifModal from "./AddGifModal";
import AddLinkModal from "./AddLinkModal";
import AddVideoModal from "./AddVideoModal";
import OverlayLayer from "./OverlayLayer";

type PageFlipInstance = {
  loadFromImages: (images: string[]) => void;
  destroy: () => void;
  flipNext: () => void;
  flipPrev: () => void;
  flip: (page: number) => void;
  turnToPage: (page: number) => void;
  on: (event: string, cb: (e: { data: unknown }) => void) => void;
};

type PageFlipCtor = new (
  el: HTMLElement,
  settings: Record<string, unknown>,
) => PageFlipInstance;

export type FlipbookMode = "editor" | "viewer";

type Props = {
  mode: FlipbookMode;
  flipbookId: string;
  flipbookName: string;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  pageUrls: string[];
  sourcePdfUrl: string;
  settings: ProjectSettings;
  overlays: Overlay[];
  onOpenSettings?: () => void;
};

export default function Flipbook({
  mode,
  flipbookId,
  flipbookName,
  pageCount,
  pageWidth,
  pageHeight,
  pageUrls,
  sourcePdfUrl,
  settings,
  overlays,
  onOpenSettings,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlipInstance | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addVideoOpen, setAddVideoOpen] = useState(false);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [addGifOpen, setAddGifOpen] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

  const { displayMode, showCover, allowKeyboardNav, allowDownload } = settings;
  const overlaysEnabled = displayMode === "single";

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;

    (async () => {
      const mod = (await import("page-flip")) as unknown as {
        PageFlip: PageFlipCtor;
      };
      if (cancelled) return;

      const isSingle = displayMode === "single";
      const pf = new mod.PageFlip(el, {
        width: pageWidth,
        height: pageHeight,
        size: "stretch",
        // PageFlip switches to portrait (single-page) when container < 2*minWidth.
        // Bumping minWidth in single mode forces that branch regardless of viewport.
        minWidth: isSingle ? 9000 : 315,
        maxWidth: isSingle ? 5000 : 1400,
        minHeight: 400,
        maxHeight: 5000,
        maxShadowOpacity: 0.5,
        showCover: isSingle ? false : showCover,
        mobileScrollSupport: false,
        usePortrait: true,
        drawShadow: true,
        flippingTime: 700,
      });

      pf.loadFromImages(pageUrls);
      pf.on("flip", (e) => setCurrentPage(e.data as number));
      pf.on("changeState", (e) => setIsFlipping(e.data !== "read"));
      flipRef.current = pf;
    })();

    return () => {
      cancelled = true;
      if (flipRef.current) {
        try {
          flipRef.current.destroy();
        } catch {}
        flipRef.current = null;
      }
    };
  }, [displayMode, pageUrls, pageWidth, pageHeight, showCover]);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!allowKeyboardNav) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
      if (e.key === "ArrowLeft") flipRef.current?.flipPrev();
      else if (e.key === "ArrowRight") flipRef.current?.flipNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [allowKeyboardNav]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) void el.requestFullscreen();
    else void document.exitFullscreen();
  }, []);

  const copyLink = useCallback(async () => {
    const url = `${window.location.origin}/v/${flipbookId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [flipbookId]);

  const saveOverlays = useCallback(
    async (next: Overlay[]) => {
      try {
        const res = await fetch(`/api/flipbooks/${flipbookId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overlays: next }),
        });
        if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
        router.refresh();
      } catch (err) {
        console.error(err);
      }
    },
    [flipbookId, router],
  );

  const handleAddVideo = useCallback(
    (video: ParsedVideo) => {
      const newOverlay: Overlay = {
        id: nanoid(8),
        type: "video",
        page: currentPage + 1,
        x: 0.2,
        y: 0.25,
        width: 0.6,
        height: 0.5,
        provider: video.provider,
        videoId: video.videoId,
      };
      void saveOverlays([...overlays, newOverlay]);
      setAddVideoOpen(false);
    },
    [currentPage, overlays, saveOverlays],
  );

  const handleAddLink = useCallback(
    (target: LinkTarget) => {
      const newOverlay: Overlay = {
        id: nanoid(8),
        type: "link",
        page: currentPage + 1,
        x: 0.3,
        y: 0.4,
        width: 0.4,
        height: 0.1,
        target,
      };
      void saveOverlays([...overlays, newOverlay]);
      setAddLinkOpen(false);
    },
    [currentPage, overlays, saveOverlays],
  );

  const handleAddGif = useCallback(
    (url: string) => {
      const newOverlay: Overlay = {
        id: nanoid(8),
        type: "gif",
        page: currentPage + 1,
        x: 0.35,
        y: 0.35,
        width: 0.3,
        height: 0.3,
        url,
      };
      void saveOverlays([...overlays, newOverlay]);
      setAddGifOpen(false);
    },
    [currentPage, overlays, saveOverlays],
  );

  const handleUpdateOverlay = useCallback(
    (updated: Overlay) => {
      const next = overlays.map((o) => (o.id === updated.id ? updated : o));
      void saveOverlays(next);
    },
    [overlays, saveOverlays],
  );

  const handleDeleteOverlay = useCallback(
    (id: string) => {
      void saveOverlays(overlays.filter((o) => o.id !== id));
    },
    [overlays, saveOverlays],
  );

  const handleNavigatePage = useCallback((page: number) => {
    flipRef.current?.flip(page - 1);
  }, []);

  const pageLabel = formatPageLabel(currentPage, pageCount, displayMode);

  return (
    <div ref={rootRef} className="flex h-screen w-full flex-col bg-[#f3f1ec]">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 text-sm">
        {mode === "editor" ? (
          <>
            <Link
              href="/flipbooks"
              className="text-zinc-500 transition-colors hover:text-zinc-900"
              title="Back to flipbooks"
              aria-label="Back to flipbooks"
            >
              ←
            </Link>
            <h1 className="truncate font-medium text-zinc-900">
              {flipbookName}
            </h1>
            <span className="text-zinc-300">·</span>
          </>
        ) : null}
        <span className="shrink-0 text-zinc-500">{pageLabel}</span>
        <div className="ml-auto flex items-center gap-1">
          {mode === "editor" ? (
            <>
              <button
                type="button"
                onClick={() => setAddVideoOpen(true)}
                disabled={!overlaysEnabled}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40"
                title={
                  overlaysEnabled
                    ? "Add a video to this page"
                    : "Switch to Single page mode to add interactive elements"
                }
              >
                <PlusIcon /> Video
              </button>
              <button
                type="button"
                onClick={() => setAddLinkOpen(true)}
                disabled={!overlaysEnabled}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40"
                title={
                  overlaysEnabled
                    ? "Add a link to this page"
                    : "Switch to Single page mode to add interactive elements"
                }
              >
                <PlusIcon /> Link
              </button>
              <button
                type="button"
                onClick={() => setAddGifOpen(true)}
                disabled={!overlaysEnabled}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40"
                title={
                  overlaysEnabled
                    ? "Add a GIF to this page"
                    : "Switch to Single page mode to add interactive elements"
                }
              >
                <PlusIcon /> GIF
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                title="Copy public link"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                title="Settings"
                aria-label="Settings"
              >
                <SettingsIcon />
              </button>
            </>
          ) : null}
          {mode === "viewer" && allowDownload ? (
            <a
              href={sourcePdfUrl}
              download
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              title="Download PDF"
              aria-label="Download PDF"
            >
              <DownloadIcon />
            </a>
          ) : null}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
        </div>
      </header>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-6 md:px-12">
        <button
          type="button"
          onClick={() => flipRef.current?.flipPrev()}
          disabled={currentPage === 0}
          className="absolute left-2 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-zinc-700 shadow-md backdrop-blur transition-opacity hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:left-6"
          aria-label="Previous page"
        >
          <ChevronIcon direction="left" />
        </button>

        <div
          ref={containerRef}
          className="relative h-full w-full max-w-6xl"
          style={{ maxHeight: "100%" }}
        >
          {overlaysEnabled ? (
            <OverlayLayer
              mode={mode}
              pageAspect={pageWidth / pageHeight}
              visiblePage={currentPage + 1}
              overlays={overlays}
              hidden={isFlipping}
              onUpdate={handleUpdateOverlay}
              onDelete={handleDeleteOverlay}
              onNavigatePage={handleNavigatePage}
            />
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => flipRef.current?.flipNext()}
          disabled={currentPage >= pageCount - 1}
          className="absolute right-2 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-zinc-700 shadow-md backdrop-blur transition-opacity hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:right-6"
          aria-label="Next page"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      {mode === "editor" ? (
        <>
          <AddVideoModal
            open={addVideoOpen}
            currentPage={currentPage + 1}
            onClose={() => setAddVideoOpen(false)}
            onAdd={handleAddVideo}
          />
          <AddLinkModal
            open={addLinkOpen}
            currentPage={currentPage + 1}
            pageCount={pageCount}
            onClose={() => setAddLinkOpen(false)}
            onAdd={handleAddLink}
          />
          <AddGifModal
            open={addGifOpen}
            flipbookId={flipbookId}
            currentPage={currentPage + 1}
            onClose={() => setAddGifOpen(false)}
            onAdd={handleAddGif}
          />
        </>
      ) : null}
    </div>
  );
}

function formatPageLabel(
  currentPage: number,
  pageCount: number,
  displayMode: ProjectSettings["displayMode"],
): string {
  if (pageCount <= 1) return "1 page";
  if (displayMode === "single") {
    return `page ${currentPage + 1} of ${pageCount}`;
  }
  if (currentPage === 0 || currentPage === pageCount - 1) {
    return `page ${currentPage + 1} of ${pageCount}`;
  }
  const left = currentPage % 2 === 0 ? currentPage : currentPage + 1;
  const right = left + 1;
  if (right > pageCount) return `page ${left} of ${pageCount}`;
  return `pages ${left}–${right} of ${pageCount}`;
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === "left" ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 18 15 12 9 6" />
      )}
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
