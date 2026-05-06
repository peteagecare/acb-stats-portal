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

export type LeadFieldType = "text" | "email" | "tel";

export type LeadField = {
  key: string;
  label: string;
  type: LeadFieldType;
  required: boolean;
  hubspotName?: string;
};

export type LeadGate = {
  enabled: boolean;
  atPage: number;
  dismissible: boolean;
  headline: string;
  subhead: string;
  buttonLabel: string;
  fields: LeadField[];
  hubspotPortalId: string;
  hubspotFormGuid: string;
};

export const DEFAULT_LEAD_GATE: LeadGate = {
  enabled: false,
  atPage: 3,
  dismissible: false,
  headline: "Read on for the full guide",
  subhead: "Pop your details in and we'll send a copy to your inbox.",
  buttonLabel: "Continue reading",
  fields: [
    { key: "firstName", label: "First name", type: "text", required: true, hubspotName: "firstname" },
    { key: "email", label: "Email", type: "email", required: true, hubspotName: "email" },
  ],
  hubspotPortalId: "",
  hubspotFormGuid: "",
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
  leadGate: LeadGate;
};
