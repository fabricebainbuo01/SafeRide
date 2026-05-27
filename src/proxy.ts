import { NextResponse, type NextRequest } from "next/server";

/**
 * Coarse route gating based on the presence of Supabase auth cookies.
 *
 * This is a fast-path filter so unauthenticated users hitting /admin or
 * /dashboard get bounced to /auth/login without rendering the page first.
 * The actual identity check + role check still happens server/client-side.
 *
 * For full session validation here, migrate to @supabase/ssr's
 * `createServerClient` with `cookies` adapter. We keep this lightweight to
 * avoid edge-runtime + cookies-mutation complexity for now.
 *
 * Note: `middleware` was renamed to `proxy` in Next.js 16. The function
 * export name must be `proxy` to match the file name.
 */

const PROTECTED_PREFIXES = ["/admin", "/dashboard"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  // Supabase cookie names vary by version/ref (often sb-<ref>-auth-token, chunked .0/.1…).
  const hasAuthCookie = req.cookies.getAll().some((c) => {
    const n = c.name;
    if (!n.startsWith("sb-")) return false;
    return (
      n.includes("auth-token") ||
      n.includes("refresh-token") ||
      n === "sb-access-token"
    );
  });

  if (hasAuthCookie) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/auth/login";
  url.searchParams.set("redirectTo", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
