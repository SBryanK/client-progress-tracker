import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Build an edge-safe `auth` wrapper from the minimal config. Crucially, this
// file does NOT import `@/lib/auth` (which pulls in Prisma + bcrypt and
// would blow up in the Edge runtime with "Code generation from strings
// disallowed").
const { auth } = NextAuth(authConfig);

/**
 * Middleware — public-by-default, auth only on write-capable surfaces.
 *
 * Anyone can READ the landing page, the clients list / detail, the weekly
 * timeline, and public share links. The private surfaces below require a
 * signed-in OWNER cookie; unauthenticated visits are bounced back to the
 * landing page with `?signin=1` so the embedded sign-in dialog opens
 * automatically.
 */
const PRIVATE_PREFIXES = [
  "/dashboard",
  "/import",
  "/reports",
  "/clients/new",
];
const PRIVATE_PATTERNS: RegExp[] = [/^\/clients\/[^/]+\/edit(\/|$)/];

// API routes that mutate state OR aggregate the entire dataset. Owner-only,
// gated at both the middleware (to short-circuit the request) and the
// route handler (defense in depth via `requireOwner()`).
const PRIVATE_API_PREFIXES = [
  "/api/import",
  "/api/share",
  "/api/reports",
  "/api/ai",
];

function isPrivate(pathname: string): boolean {
  if (PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (PRIVATE_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (PRIVATE_PATTERNS.some((re) => re.test(pathname))) return true;
  return false;
}

export default auth((req: NextRequest & { auth?: unknown }) => {
  const { pathname } = req.nextUrl;

  if (!isPrivate(pathname)) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("signin", "1");
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}) as unknown as (req: NextRequest) => Response;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
