import type {
  DisplayMode,
  LinkTarget,
  Overlay,
  ProjectSettings,
  VideoProvider,
} from "./types";

const VALID_DISPLAY_MODES: DisplayMode[] = ["single", "double"];
const VALID_VIDEO_PROVIDERS: VideoProvider[] = ["youtube", "vimeo"];

export function sanitiseSettings(
  input: unknown,
): Partial<ProjectSettings> | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const out: Partial<ProjectSettings> = {};

  if (typeof raw.displayMode === "string") {
    if (!VALID_DISPLAY_MODES.includes(raw.displayMode as DisplayMode)) {
      return null;
    }
    out.displayMode = raw.displayMode as DisplayMode;
  }
  if (typeof raw.showCover === "boolean") out.showCover = raw.showCover;
  if (typeof raw.allowKeyboardNav === "boolean") {
    out.allowKeyboardNav = raw.allowKeyboardNav;
  }
  if (typeof raw.allowDownload === "boolean") {
    out.allowDownload = raw.allowDownload;
  }
  return out;
}

function clamp01(n: unknown): number | null {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return Math.max(0, Math.min(1, n));
}

function sanitiseLinkTarget(input: unknown): LinkTarget | null {
  if (!input || typeof input !== "object") return null;
  const t = input as Record<string, unknown>;
  if (t.kind === "url") {
    if (typeof t.url !== "string" || t.url.length === 0 || t.url.length > 2000) {
      return null;
    }
    try {
      const u = new URL(t.url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    } catch {
      return null;
    }
    return { kind: "url", url: t.url };
  }
  if (t.kind === "page") {
    if (
      typeof t.page !== "number" ||
      !Number.isInteger(t.page) ||
      t.page < 1
    ) {
      return null;
    }
    return { kind: "page", page: t.page };
  }
  return null;
}

function sanitiseOverlay(input: unknown): Overlay | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  if (typeof raw.id !== "string" || !/^[\w-]{1,40}$/.test(raw.id)) return null;
  if (
    typeof raw.page !== "number" ||
    !Number.isInteger(raw.page) ||
    raw.page < 1
  ) {
    return null;
  }

  const x = clamp01(raw.x);
  const y = clamp01(raw.y);
  const width = clamp01(raw.width);
  const height = clamp01(raw.height);
  if (x === null || y === null || width === null || height === null) return null;
  if (width <= 0 || height <= 0) return null;

  const base = { id: raw.id, page: raw.page, x, y, width, height };

  if (raw.type === "video") {
    if (
      typeof raw.provider !== "string" ||
      !VALID_VIDEO_PROVIDERS.includes(raw.provider as VideoProvider)
    ) {
      return null;
    }
    if (typeof raw.videoId !== "string" || !/^[\w-]{4,40}$/.test(raw.videoId)) {
      return null;
    }
    return {
      ...base,
      type: "video",
      provider: raw.provider as VideoProvider,
      videoId: raw.videoId,
    };
  }

  if (raw.type === "link") {
    const target = sanitiseLinkTarget(raw.target);
    if (!target) return null;
    return { ...base, type: "link", target };
  }

  if (raw.type === "gif") {
    if (typeof raw.url !== "string" || raw.url.length === 0 || raw.url.length > 2000) {
      return null;
    }
    // Allow Vercel Blob URLs (https) or any other absolute http(s) URL
    try {
      const u = new URL(raw.url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    } catch {
      return null;
    }
    return { ...base, type: "gif", url: raw.url };
  }

  return null;
}

export function sanitiseOverlays(input: unknown): Overlay[] | null {
  if (!Array.isArray(input)) return null;
  const out: Overlay[] = [];
  for (const item of input) {
    const o = sanitiseOverlay(item);
    if (!o) return null;
    out.push(o);
  }
  return out;
}
