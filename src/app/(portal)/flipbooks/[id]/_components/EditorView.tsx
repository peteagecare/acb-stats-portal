"use client";

import { useState } from "react";
import type { FlipbookManifest } from "@/lib/flipbook/types";
import Flipbook from "./Flipbook";
import SettingsPanel from "./SettingsPanel";

export default function EditorView({
  manifest,
}: {
  manifest: FlipbookManifest;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Flipbook
        mode="editor"
        flipbookId={manifest.id}
        flipbookName={manifest.name}
        pageCount={manifest.pageCount}
        pageWidth={manifest.pageWidth}
        pageHeight={manifest.pageHeight}
        pageUrls={manifest.pageUrls}
        sourcePdfUrl={manifest.sourcePdfUrl}
        settings={manifest.settings}
        overlays={manifest.overlays}
        leadGate={manifest.leadGate}
        gateUnlocked
        onOpenSettings={() => setOpen(true)}
      />
      <SettingsPanel
        flipbookId={manifest.id}
        open={open}
        onClose={() => setOpen(false)}
        settings={manifest.settings}
        leadGate={manifest.leadGate}
        pageCount={manifest.pageCount}
      />
    </>
  );
}
