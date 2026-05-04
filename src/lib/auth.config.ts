// Edge-runtime-safe NextAuth config for `middleware.ts`.
//
// IMPORTANT: this file must NOT import bcrypt, Prisma, the PrismaAdapter,
// or any other Node-only module. The full-feature config lives in
// `src/lib/auth.ts` and is used by the route handlers (Node runtime).
//
// We intentionally do NOT supply an `authorized` callback here. Auth.js v5
// interprets a missing `authorized` as "any route is allowed by default"
// and leaves routing to our own logic in `middleware.ts`, which hand-picks
// the PRIVATE_PREFIXES / PRIVATE_PATTERNS to gate. Supplying
// `authorized: () => !!session` would flip the default to "deny everyone
// without a session" and force even the public landing page to demand a
// sign-in — which is the opposite of what we want.
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/?signin=1" },
  providers: [], // Real Credentials provider lives in auth.ts (Node runtime).
};
