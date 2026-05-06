"use client";

import { upload as uploadToBlob } from "@vercel/blob/client";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

const RENDER_SCALE = 2.0;
const PARALLEL_PAGES = 4;

type Progress = { stage: string; done: number; total: number } | null;

export default function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null);
      setBusy(true);
      setProgress({ stage: "Reading PDF…", done: 0, total: 1 });

      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
        }).promise;
        const pageCount = pdf.numPages;

        const id = nanoid(10);
        const pageUrls: string[] = new Array(pageCount);
        let pageWidth = 0;
        let pageHeight = 0;

        const totalSteps = pageCount + 1;
        let done = 0;
        setProgress({ stage: "Rendering pages…", done, total: totalSteps });

        for (let start = 0; start < pageCount; start += PARALLEL_PAGES) {
          const end = Math.min(start + PARALLEL_PAGES, pageCount);
          await Promise.all(
            Array.from({ length: end - start }, async (_, i) => {
              const pageNum = start + i + 1;
              const page = await pdf.getPage(pageNum);
              const viewport = page.getViewport({ scale: RENDER_SCALE });
              const canvas = document.createElement("canvas");
              canvas.width = Math.ceil(viewport.width);
              canvas.height = Math.ceil(viewport.height);
              const ctx = canvas.getContext("2d");
              if (!ctx) throw new Error("Could not create canvas context");
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              await page.render({
                canvasContext: ctx,
                viewport,
                canvas,
              }).promise;

              if (pageNum === 1) {
                pageWidth = canvas.width;
                pageHeight = canvas.height;
              }

              const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                  (b) =>
                    b
                      ? resolve(b)
                      : reject(new Error(`Could not encode page ${pageNum}`)),
                  "image/png",
                );
              });

              const result = await uploadToBlob(
                `flipbooks/${id}/pages/page-${pageNum}.png`,
                blob,
                {
                  access: "public",
                  handleUploadUrl: "/api/flipbooks/upload",
                },
              );
              pageUrls[pageNum - 1] = result.url;
              done++;
              setProgress({
                stage: "Rendering pages…",
                done,
                total: totalSteps,
              });
            }),
          );
        }

        setProgress({
          stage: "Uploading source PDF…",
          done,
          total: totalSteps,
        });
        const pdfResult = await uploadToBlob(
          `flipbooks/${id}/source.pdf`,
          file,
          {
            access: "public",
            handleUploadUrl: "/api/flipbooks/upload",
          },
        );
        done++;
        setProgress({
          stage: "Finalising…",
          done,
          total: totalSteps,
        });

        const name = file.name.replace(/\.pdf$/i, "");
        const res = await fetch("/api/flipbooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            name,
            pageCount,
            pageWidth,
            pageHeight,
            sourcePdfUrl: pdfResult.url,
            pageUrls,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? `Create failed (${res.status})`);
        }

        router.push(`/flipbooks/${id}`);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Upload failed");
        setBusy(false);
        setProgress(null);
      }
    },
    [router],
  );

  const pct = progress
    ? Math.round((progress.done / Math.max(progress.total, 1)) * 100)
    : 0;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        <PdfIcon />
        {busy ? "Processing…" : "Upload PDF"}
      </button>
      {progress ? (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span>{progress.stage}</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function PdfIcon() {
  return (
    <svg
      width="14"
      height="14"
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
