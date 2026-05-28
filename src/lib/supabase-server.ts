import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

function createCookieServerClient(
  cookieStore: Awaited<ReturnType<typeof cookies>>
): SupabaseClient {
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot write cookies; proxy/route handlers do.
          }
        },
      },
    }
  );
}

/**
 * Supabase client for Route Handlers when the browser forwards the session JWT
 * via `Authorization: Bearer <access_token>`.
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
 * Server-side Supabase client that reads/writes auth cookies via @supabase/ssr
 * so RLS policies and route handlers see the correct auth.uid().
 */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createCookieServerClient(cookieStore);
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
