"use client";

import { useEffect, useState } from "react";
import { parseVideoUrl, type ParsedVideo } from "@/lib/flipbook/video";

type Props = {
  open: boolean;
  currentPage: number;
  onClose: () => void;
  onAdd: (video: ParsedVideo) => void;
};

export default function AddVideoModal({
  open,
  currentPage,
  onClose,
  onAdd,
}: Props) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setUrl("");
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
    const parsed = parseVideoUrl(url);
    if (!parsed) {
      setError("Couldn't read that URL — paste a YouTube or Vimeo link.");
      return;
    }
    onAdd(parsed);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Add video</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Will be placed on page {currentPage}. YouTube or Vimeo URL.
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
          placeholder="https://www.youtube.com/watch?v=..."
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-900"
        />
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
            disabled={!url.trim()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
