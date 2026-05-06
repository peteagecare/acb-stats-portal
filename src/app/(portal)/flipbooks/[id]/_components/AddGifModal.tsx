"use client";

import { upload as uploadToBlob } from "@vercel/blob/client";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";

const ACCEPT = "image/gif,image/webp,image/png,image/apng,image/jpeg";
const EXT_BY_TYPE: Record<string, string> = {
  "image/gif": "gif",
  "image/webp": "webp",
  "image/png": "png",
  "image/apng": "apng",
  "image/jpeg": "jpg",
};
const MAX_BYTES = 50 * 1024 * 1024;

type Props = {
  open: boolean;
  flipbookId: string;
  currentPage: number;
  onClose: () => void;
  onAdd: (url: string) => void;
};

export default function AddGifModal({
  open,
  flipbookId,
  currentPage,
  onClose,
  onAdd,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!open) {
      setError(null);
      setBusy(false);
      setDragOver(false);
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

  const upload = async (file: File) => {
    setError(null);
    const ext = EXT_BY_TYPE[file.type];
    if (!ext) {
      setError("Unsupported file type. Use GIF, WebP, PNG, or JPEG.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File too large. Max size is 50 MB.");
      return;
    }
    setBusy(true);
    try {
      const result = await uploadToBlob(
        `flipbooks/${flipbookId}/gifs/${nanoid(8)}.${ext}`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/flipbooks/upload",
        },
      );
      onAdd(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Add GIF</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Will be placed on page {currentPage}. Animated GIFs loop
              automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-zinc-400 hover:text-zinc-700 disabled:opacity-40"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) void upload(file);
          }}
          className={`flex h-36 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
            dragOver
              ? "border-zinc-900 bg-zinc-50"
              : "border-zinc-300 hover:border-zinc-400"
          } ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            disabled={busy}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <span className="text-sm text-zinc-700">
            {busy ? "Uploading…" : "Drop a GIF here or click to choose"}
          </span>
          <span className="mt-1 text-xs text-zinc-400">
            GIF · WebP · PNG · JPEG · up to 50 MB
          </span>
        </label>

        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
