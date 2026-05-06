export type VideoProvider = "youtube" | "vimeo";

export type OverlayBase = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VideoOverlay = OverlayBase & {
  type: "video";
  provider: VideoProvider;
  videoId: string;
};

export type LinkTarget =
  | { kind: "url"; url: string }
  | { kind: "page"; page: number };

export type LinkOverlay = OverlayBase & {
  type: "link";
  target: LinkTarget;
};

export type GifOverlay = OverlayBase & {
  type: "gif";
  url: string;
};

export type Overlay = VideoOverlay | LinkOverlay | GifOverlay;

export type DisplayMode = "single" | "double";

export type ProjectSettings = {
  displayMode: DisplayMode;
  showCover: boolean;
  allowKeyboardNav: boolean;
  allowDownload: boolean;
};

export const DEFAULT_SETTINGS: ProjectSettings = {
  displayMode: "double",
  showCover: true,
  allowKeyboardNav: true,
  allowDownload: false,
};

export type FlipbookManifest = {
  id: string;
  name: string;
  createdAt: string;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  sourcePdfUrl: string;
  pageUrls: string[];
  overlays: Overlay[];
  settings: ProjectSettings;
};
