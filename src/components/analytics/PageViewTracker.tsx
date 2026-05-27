"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

/**
 * Fires a single insert into `public.page_views` whenever the route changes.
 *
 * Notes:
 *   * Mounted in the root layout, so it covers every route.
 *   * Skips `/admin/**` so internal usage doesn't pollute the Total Traffic
 *     counter on the Super Admin BI dashboard.
 *   * Uses `sessionStorage` to dedupe rapid double-fires (React 18 StrictMode
 *     in dev re-runs the effect; client-side navigations sometimes settle the
 *     same pathname twice on hydration).
 *   * Insert errors are intentionally swallowed — analytics must never break
 *     the page render.
 */
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/admin")) return;

    const client = getSupabase();
    if (!client) return;

    const dedupeKey = `pv:${pathname}`;
    const last = Number(sessionStorage.getItem(dedupeKey) ?? 0);
    const now = Date.now();
    if (now - last < 1500) return;
    sessionStorage.setItem(dedupeKey, String(now));

    const referrer =
      typeof document !== "undefined" && document.referrer ? document.referrer : null;

    void client
      .from("page_views")
      .insert({ path: pathname, referrer })
      .then(({ error }) => {
        if (error && process.env.NODE_ENV !== "production") {
          console.warn("[page_views] insert failed:", error.message);
        }
      });
  }, [pathname]);

  return null;
}
