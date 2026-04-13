/**
 * Simple in-memory TTL cache for API route responses.
 *
 * Designed for a low-traffic internal dashboard on Vercel serverless.
 * Each serverless instance gets its own cache — that's fine for this
 * use case since even a single-instance hit avoids redundant HubSpot
 * calls within the TTL window.
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** Default TTL: 5 minutes */
export const TTL = {
  REALTIME: 0,           // no cache
  SHORT: 5 * 60_000,     // 5 min  — operational data (visits, installs)
  MEDIUM: 10 * 60_000,   // 10 min — aggregate stats
  LONG: 15 * 60_000,     // 15 min — slow-moving counts
  VERY_LONG: 60 * 60_000, // 1 hr  — historical / previous period
} as const;

/**
 * Return cached data if fresh, otherwise call `fetcher`, cache the
 * result, and return it. Expired entries are cleaned up lazily.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (ttlMs <= 0) return fetcher();

  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expires > now) {
    return existing.data;
  }

  const data = await fetcher();
  store.set(key, { data, expires: now + ttlMs });

  // Lazy cleanup: every 100 writes, purge expired entries
  if (store.size % 100 === 0) {
    for (const [k, v] of store) {
      if (v.expires <= now) store.delete(k);
    }
  }

  return data;
}

/**
 * Build a deterministic cache key from a route name + params.
 * Sorts param keys so order doesn't matter.
 */
export function cacheKey(route: string, params: Record<string, string | undefined>): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `${route}?${sorted}`;
}
