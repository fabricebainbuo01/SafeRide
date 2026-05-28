"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { publicEnv, hasSupabaseConfig } from "@/lib/env";

/**
 * Browser-side Supabase singleton.
 *
 * Uses @supabase/ssr so sessions are stored in cookies (not localStorage),
 * which lets Next.js proxy/middleware and Server Components read the session.
 */

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!hasSupabaseConfig) return null;
  if (_client) return _client;
  _client = createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL!,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return _client;
}

/**
 * Convenience wrapper: throws when called without a configured client.
 * Use only inside event handlers where a missing config is genuinely fatal
 * (e.g. handleBooking, handleLogin).
 */
export function requireSupabase(): SupabaseClient {
  const client = getSupabase();
  if (!client) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    );
  }
  return client;
}

/**
 * Current user from the cached session — prefer over `auth.getUser()` in client
 * components when you only need `session.user`. Avoids concurrent calls racing
 * on Supabase Auth's internal lock (React Strict Mode double-mount +
 * `getUser()` can throw "another request stole it").
 *
 * Calls are serialized with a tiny promise queue so parallel mounts don't hit
 * the auth lock simultaneously.
 */
let _sessionUserChain: Promise<unknown> = Promise.resolve();

export async function getSessionUser(
  client: SupabaseClient
): Promise<User | null> {
  const task = _sessionUserChain.then(async () => {
    const {
      data: { session },
    } = await client.auth.getSession();
    return session?.user ?? null;
  });
  _sessionUserChain = task.catch(() => undefined);
  return task;
}
