"use client";

import { Popover, usePopover } from "@/app/components/Pickers";
import { MoveToPanel } from "./_move-to-panel";

/** Compact "Move" button rendered at the end of a task row. Opens a Popover
 *  anchored to the button containing the same MoveToPanel used by the
 *  right-click context menu. Caller owns the move action via `onMove`.
 */
export function MoveToButton({
  currentProjectId,
  currentSectionId,
  onMove,
}: {
  currentProjectId: string;
  currentSectionId: string | null;
  onMove: (projectId: string, sectionId: string | null) => Promise<void>;
}) {
  const { open, rect, triggerRef, toggle, hide } = usePopover<HTMLButtonElement>();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        title="Move to project or section"
        style={{
          flexShrink: 0,
          padding: "3px 8px", borderRadius: 6,
          border: "1px solid var(--color-border)",
          background: "transparent",
          color: "var(--color-text-secondary)",
          fontSize: 11, fontWeight: 500, fontFamily: "inherit",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        Move
      </button>
      <Popover open={open} onClose={hide} anchorRect={rect} width={300} align="right">
        <MoveToPanel
          currentProjectId={currentProjectId}
          currentSectionId={currentSectionId}
          onMove={onMove}
          onClose={hide}
        />
      </Popover>
    </>
  );
}
