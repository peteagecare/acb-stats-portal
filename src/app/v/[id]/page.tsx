import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { flipbookLeads, flipbooks } from "@/db/schema";
import {
  DEFAULT_LEAD_GATE,
  DEFAULT_SETTINGS,
  type FlipbookManifest,
  type LeadGate,
  type Overlay,
  type ProjectSettings,
} from "@/lib/flipbook/types";
import { leadCookieName } from "@/lib/flipbook/lead-cookie";
import Flipbook from "@/app/(portal)/flipbooks/[id]/_components/Flipbook";

export const dynamic = "force-dynamic";

export default async function PublicViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [row] = await db
    .select()
    .from(flipbooks)
    .where(eq(flipbooks.id, id))
    .limit(1);
  if (!row) notFound();

  const leadGate: LeadGate = {
    ...DEFAULT_LEAD_GATE,
    ...((row.leadGate as Partial<LeadGate>) ?? {}),
  };

  let gateUnlocked = !leadGate.enabled;
  if (leadGate.enabled) {
    const cookieStore = await cookies();
    const cookieId = cookieStore.get(leadCookieName(id))?.value;
    if (cookieId) {
      const [match] = await db
        .select({ id: flipbookLeads.id })
        .from(flipbookLeads)
        .where(
          and(
            eq(flipbookLeads.flipbookId, id),
            eq(flipbookLeads.cookieId, cookieId),
          ),
        )
        .limit(1);
      if (match) gateUnlocked = true;
    }
  }

  const manifest: FlipbookManifest = {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    pageCount: row.pageCount,
    pageWidth: row.pageWidth,
    pageHeight: row.pageHeight,
    sourcePdfUrl: row.sourcePdfUrl,
    pageUrls: (row.pageUrls as string[]) ?? [],
    overlays: (row.overlays as Overlay[]) ?? [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...((row.settings as Partial<ProjectSettings>) ?? {}),
    },
    leadGate,
  };

  return (
    <Flipbook
      mode="viewer"
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
      gateUnlocked={gateUnlocked}
    />
  );
}
