import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Supabase client for Route Handlers when the browser forwards the session JWT
 * via `Authorization: Bearer <access_token>`. This matches how `@supabase/supabase-js`
 * stores sessions in localStorage by default (no auth cookies on the Next.js server).
 */
export function createSupabaseWithAccessToken(accessToken: string): SupabaseClient {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    }
  );
}

/**
 * Server-side Supabase client that forwards the user's auth cookies so
 * RLS policies see the correct auth.uid().
 *
 * NOTE: this is a lightweight shim. For full session refresh / writeback
 * support, migrate to @supabase/ssr's createServerClient. For read-only
 * use in Route Handlers and Server Components this is sufficient.
 */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;
  const refreshToken = cookieStore.get("sb-refresh-token")?.value;

  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers },
    }
  );

  if (accessToken && refreshToken) {
    await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  return client;
}

/**
 * Service-role client for privileged server-side operations
 * (e.g. confirming a payment via webhook, approving an agency application).
 * Never import this from a client component.
 */
export function createServiceSupabase(): SupabaseClient {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it to .env.local for privileged server operations."
    );
  }
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
