import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Handles Supabase email-confirm and OAuth redirects (?code=...).
 * Exchanges the PKCE code for a cookie-backed session, then redirects in-app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
  const next = redirectTo.startsWith("/") ? redirectTo : "/dashboard";

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const loginUrl = new URL("/auth/login", origin);
  const authError =
    searchParams.get("error_description") ??
    searchParams.get("error") ??
    "auth_callback_failed";
  loginUrl.searchParams.set("error", authError);
  return NextResponse.redirect(loginUrl);
}