import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { flipbooks } from "@/db/schema";
import {
  DEFAULT_SETTINGS,
  type FlipbookManifest,
  type Overlay,
  type ProjectSettings,
} from "@/lib/flipbook/types";
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
    />
  );
}
