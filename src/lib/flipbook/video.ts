import type { VideoProvider } from "./types";

export type ParsedVideo = {
  provider: VideoProvider;
  videoId: string;
};

export function parseVideoUrl(input: string): ParsedVideo | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      const v = url.searchParams.get("v");
      if (v && /^[\w-]{6,}$/.test(v)) return { provider: "youtube", videoId: v };
    }
    const shortsMatch = url.pathname.match(/^\/shorts\/([\w-]{6,})/);
    if (shortsMatch) return { provider: "youtube", videoId: shortsMatch[1] };
    const embedMatch = url.pathname.match(/^\/embed\/([\w-]{6,})/);
    if (embedMatch) return { provider: "youtube", videoId: embedMatch[1] };
  }

  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\//, "");
    if (/^[\w-]{6,}$/.test(id)) return { provider: "youtube", videoId: id };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    const idSegment = segments.find((s) => /^\d{5,}$/.test(s));
    if (idSegment) return { provider: "vimeo", videoId: idSegment };
  }

  return null;
}

export function embedUrlFor(
  overlay: ParsedVideo,
  autoplay: boolean,
): string {
  if (overlay.provider === "youtube") {
    const params = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
    });
    if (autoplay) {
      params.set("autoplay", "1");
      params.set("mute", "1");
    }
    return `https://www.youtube.com/embed/${overlay.videoId}?${params.toString()}`;
  }
  const params = new URLSearchParams({
    title: "0",
    byline: "0",
    portrait: "0",
  });
  if (autoplay) {
    params.set("autoplay", "1");
    params.set("muted", "1");
  }
  return `https://player.vimeo.com/video/${overlay.videoId}?${params.toString()}`;
}
