"use client";

import { useEffect, useState } from "react";
import type { LinkTarget } from "@/lib/flipbook/types";

type Props = {
  open: boolean;
  currentPage: number;
  pageCount: number;
  onClose: () => void;
  onAdd: (target: LinkTarget) => void;
};

export default function AddLinkModal({
  open,
  currentPage,
  pageCount,
  onClose,
  onAdd,
}: Props) {
  const [kind, setKind] = useState<"url" | "page">("url");
  const [url, setUrl] = useState("");
  const [pageInput, setPageInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setKind("url");
      setUrl("");
      setPageInput("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = () => {
    if (kind === "url") {
      const trimmed = url.trim();
      try {
        const u = new URL(trimmed);
        if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
      } catch {
        setError("Enter a valid http:// or https:// URL.");
        return;
      }
      onAdd({ kind: "url", url: trimmed });
      return;
    }
    const n = Number.parseInt(pageInput, 10);
    if (!Number.isInteger(n) || n < 1 || n > pageCount) {
      setError(`Page must be between 1 and ${pageCount}.`);
      return;
    }
    onAdd({ kind: "page", page: n });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Add link</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Will be placed on page {currentPage}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setKind("url");
              setError(null);
            }}
            className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
              kind === "url"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Web address
          </button>
          <button
            type="button"
            onClick={() => {
              setKind("page");
              setError(null);
            }}
            className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
              kind === "page"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Another page
          </button>
        </div>

        {kind === "url" ? (
          <input
            type="url"
            autoFocus
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="https://example.com"
            className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-900"
          />
        ) : (
          <input
            type="number"
            autoFocus
            min={1}
            max={pageCount}
            value={pageInput}
            onChange={(e) => {
              setPageInput(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={`Page number (1 – ${pageCount})`}
            className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-900"
          />
        )}

        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={kind === "url" ? !url.trim() : !pageInput.trim()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
