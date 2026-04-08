/**
 * Tiny JSON-on-Vercel-Blob helper.
 *
 * The dashboard has several "small JSON file" persistence needs (goals,
 * ad-spend, social/review history snapshots, AI feedback). On Vercel
 * serverless the local filesystem is read-only outside /tmp, so the old
 * `fs.writeFileSync(...)` approach silently failed in production.
 *
 * This module wraps `@vercel/blob` so each store is a single named blob
 * containing JSON. If `BLOB_READ_WRITE_TOKEN` is not configured (e.g. in
 * local dev without `vercel env pull`), it falls back to reading the
 * project-root JSON file so local development still works.
 */

import { put, head } from "@vercel/blob";
import fs from "fs";
import path from "path";

const HAS_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

export async function loadJson<T>(key: string, fallbackFile: string, defaults: T): Promise<T> {
  if (HAS_BLOB) {
    try {
      const meta = await head(key).catch(() => null);
      if (meta?.url) {
        const res = await fetch(meta.url, { cache: "no-store" });
        if (res.ok) return (await res.json()) as T;
      }
    } catch (e) {
      console.error(`[blob-store] head/fetch ${key} failed:`, e);
    }
    // First write or fetch failure — fall back to bundled defaults file
  }

  try {
    const filePath = path.resolve(fallbackFile);
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return defaults;
  }
}

export async function saveJson<T>(key: string, fallbackFile: string, data: T): Promise<void> {
  if (HAS_BLOB) {
    try {
      await put(key, JSON.stringify(data, null, 2), {
        access: "public",
        contentType: "application/json",
        allowOverwrite: true,
        addRandomSuffix: false,
        cacheControlMaxAge: 0,
      });
      return;
    } catch (e) {
      console.error(`[blob-store] put ${key} failed:`, e);
      // Fall through to local-fs attempt
    }
  }

  // Local dev (or Blob failure): try writing the file. EROFS on Vercel is
  // expected if Blob isn't configured — log only unexpected errors.
  try {
    const filePath = path.resolve(fallbackFile);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code !== "EROFS" && code !== "EACCES") {
      console.error(`[blob-store] fs write ${fallbackFile} failed:`, e);
    }
  }
}
