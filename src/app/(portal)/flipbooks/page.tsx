import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { flipbooks } from "@/db/schema";
import ProjectsTable, {
  type FlipbookRow,
} from "./_components/ProjectsTable";
import UploadDropzone from "./_components/UploadDropzone";

export const dynamic = "force-dynamic";

export default async function FlipbooksPage() {
  const rows = await db
    .select({
      id: flipbooks.id,
      name: flipbooks.name,
      pageCount: flipbooks.pageCount,
      pageUrls: flipbooks.pageUrls,
      createdAt: flipbooks.createdAt,
    })
    .from(flipbooks)
    .orderBy(desc(flipbooks.createdAt));

  const list: FlipbookRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    pageCount: r.pageCount,
    pageThumbnailUrl: ((r.pageUrls as string[]) ?? [])[0] ?? "",
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <div className="flex flex-1">
        <aside className="w-60 shrink-0 border-r border-zinc-200 bg-white p-4">
          <UploadDropzone />
          <div className="mt-6">
            <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Library
            </h2>
            <ul className="mt-2">
              <li className="flex items-center justify-between rounded-md bg-blue-50 px-2 py-1.5 text-sm font-medium text-blue-700">
                <span>Home</span>
                <span className="text-xs text-blue-600/70">{list.length}</span>
              </li>
            </ul>
          </div>
        </aside>

        <main className="flex-1 overflow-auto px-8 py-8">
          <ProjectsTable flipbooks={list} />
        </main>
      </div>
    </div>
  );
}
