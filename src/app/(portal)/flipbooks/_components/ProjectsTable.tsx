"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type FlipbookRow = {
  id: string;
  name: string;
  pageCount: number;
  pageThumbnailUrl: string;
  createdAt: string;
};

type Props = {
  flipbooks: FlipbookRow[];
};

export default function ProjectsTable({ flipbooks }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flipbooks;
    return flipbooks.filter((p) => p.name.toLowerCase().includes(q));
  }, [flipbooks, query]);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Flipbooks
        </h1>
        <div className="relative w-full max-w-sm">
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by flipbook title"
            className="block w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-900"
          />
        </div>
      </div>

      <div className="mt-6 rounded-md border border-zinc-200 bg-white">
        <div className="grid grid-cols-[1fr_160px_120px_40px] items-center gap-4 rounded-t-md border-b border-zinc-200 bg-zinc-50 px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          <div>Flipbook</div>
          <div>Last modified</div>
          <div>Pages</div>
          <div />
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-zinc-400">
            {query
              ? "No flipbooks match your search."
              : "No flipbooks yet — upload a PDF to get started."}
          </p>
        ) : (
          <ul>
            {filtered.map((p) => (
              <ProjectRow key={p.id} flipbook={p} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ProjectRow({ flipbook }: { flipbook: FlipbookRow }) {
  const router = useRouter();
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => setMenuPos(null);

  const toggleMenu = () => {
    if (menuPos) {
      closeMenu();
      return;
    }
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  };

  useEffect(() => {
    if (!menuPos) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        closeMenu();
      }
    };
    const onScrollOrResize = () => closeMenu();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [menuPos]);

  const onDelete = async () => {
    if (!confirm(`Delete "${flipbook.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/flipbooks/${flipbook.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`DELETE failed: ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error(err);
      setDeleting(false);
    }
  };

  const onCopyLink = async () => {
    const url = `${window.location.origin}/v/${flipbook.id}`;
    await navigator.clipboard.writeText(url);
    closeMenu();
  };

  return (
    <li
      className={`grid grid-cols-[1fr_160px_120px_40px] items-center gap-4 border-b border-zinc-100 px-5 py-3 last:border-b-0 transition-colors hover:bg-zinc-50 ${
        deleting ? "opacity-40" : ""
      }`}
    >
      <Link
        href={`/flipbooks/${flipbook.id}`}
        className="flex min-w-0 items-center gap-4"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={flipbook.pageThumbnailUrl}
          alt=""
          className="h-12 w-16 shrink-0 rounded border border-zinc-200 bg-zinc-100 object-cover"
        />
        <div className="min-w-0">
          <div className="truncate font-medium text-zinc-900">
            {flipbook.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
            <PagesIcon />
            <span>
              {flipbook.pageCount}{" "}
              {flipbook.pageCount === 1 ? "page" : "pages"}
            </span>
          </div>
        </div>
      </Link>
      <div className="text-sm text-zinc-700">
        {formatDate(flipbook.createdAt)}
      </div>
      <div className="text-sm text-zinc-700">{flipbook.pageCount}</div>
      <div className="flex justify-end">
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleMenu}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="More actions"
        >
          <MoreIcon />
        </button>
        {menuPos
          ? createPortal(
              <div
                ref={menuRef}
                className="fixed z-50 w-44 rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg"
                style={{ top: menuPos.top, right: menuPos.right }}
              >
                <Link
                  href={`/flipbooks/${flipbook.id}`}
                  className="block px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
                >
                  Edit
                </Link>
                <Link
                  href={`/v/${flipbook.id}`}
                  target="_blank"
                  className="block px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
                >
                  Open public link
                </Link>
                <button
                  type="button"
                  onClick={onCopyLink}
                  className="block w-full px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-50"
                >
                  Copy public link
                </button>
                <div className="my-1 h-px bg-zinc-100" />
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    void onDelete();
                  }}
                  className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>,
              document.body,
            )
          : null}
      </div>
    </li>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SearchIcon() {
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
      className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function PagesIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
