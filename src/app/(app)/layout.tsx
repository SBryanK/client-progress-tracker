import { auth } from "@/lib/auth";
import { PublicHeader } from "@/components/public-header";

/**
 * Shared chrome for every page in the `(app)` group.
 *
 * The public header is the top-of-page element for BOTH anonymous and
 * signed-in visitors.  The header swaps in a "Dashboard" / "Sign out"
 * control set once the visitor is signed in (see {@link PublicHeader}).
 *
 * Private routes (dashboard, reports, import, client edit/new) enforce
 * access control themselves via `auth()` + `redirect` on role mismatch,
 * plus an identical short-circuit in `middleware.ts`.  No extra chrome
 * is needed; the public header already exposes the owner-only Dashboard /
 * Reports / Import links once a user signs in.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const signedInUser = session?.user?.id
    ? {
        name: session.user.name ?? session.user.email ?? "User",
        email: session.user.email ?? "",
        role: (session.user.role as "OWNER" | "VIEWER") ?? "VIEWER",
      }
    : null;

  return (
    <>
      <PublicHeader signedInUser={signedInUser} />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-20 py-8 sm:py-10 animate-fade-in">
        {children}
      </main>
      <footer className="mt-auto border-t border-border/80 w-full">
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-20 py-6 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-subtle">
          <span>© {new Date().getFullYear()} Bryan 郭檍祥 · Tencent Cloud</span>
          <span className="font-medium">EdgeOne Solutions Architect Intern</span>
        </div>
      </footer>
    </>
  );
}
