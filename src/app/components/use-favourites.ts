"use client";

import { useCallback, useEffect, useState } from "react";

const EVENT = "acb-favourites-changed";

export interface FavouriteProject {
  projectId: string;
  name: string;
  companyId: string;
  status: string;
}

/** Cross-component favourites sync. Each call to useFavourites() shares the
 *  same in-memory snapshot via a window event so toggling in one place
 *  immediately updates the heart everywhere else.
 */
export function useFavourites(): {
  favourites: Set<string>;
  list: FavouriteProject[];
  loading: boolean;
  toggle: (projectId: string) => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [list, setList] = useState<FavouriteProject[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me/favourites", { cache: "no-store" });
      if (!res.ok) { setLoading(false); return; }
      const j = (await res.json()) as { projectIds: string[]; favourites: FavouriteProject[] };
      setFavourites(new Set(j.projectIds));
      setList(j.favourites ?? []);
    } catch {
      // ignore — keep prior snapshot
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    function onChanged() {
      // Always refetch when something else toggled — gets us the rich list.
      void refresh();
    }
    window.addEventListener(EVENT, onChanged);
    return () => window.removeEventListener(EVENT, onChanged);
  }, [refresh]);

  const toggle = useCallback(async (projectId: string) => {
    const next = new Set(favourites);
    const isPinned = next.has(projectId);
    if (isPinned) next.delete(projectId);
    else next.add(projectId);
    setFavourites(next);

    try {
      await fetch("/api/me/favourites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, pinned: !isPinned }),
      });
      window.dispatchEvent(new CustomEvent(EVENT));
      void refresh();
    } catch {
      void refresh();
    }
  }, [favourites, refresh]);

  return { favourites, list, loading, toggle, refresh };
}
