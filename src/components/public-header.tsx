"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState, Suspense } from "react";
import { LogOut, Moon, Sun, Plus } from "lucide-react";
import { SignInDialog } from "@/components/signin-dialog";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/components/lang-provider";
import { cn } from "@/lib/utils";

export function PublicHeader({
  signedInUser,
}: {
  signedInUser: { name: string; email: string; role: "OWNER" | "VIEWER" } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLang();
  const [dark, setDark] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  // Track scroll position so the header can grow a shadow when it detaches
  // from the page — a classic signal that it's a sticky element.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!signedInUser) return;
    if (searchParams.has("signin") || searchParams.has("next")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("signin");
      url.searchParams.delete("next");
      router.replace(url.pathname + (url.search ? url.search : ""), {
        scroll: false,
      });
    }
  }, [signedInUser, searchParams, router]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  const publicNav = [
    { href: "/", label: t("nav.home") },
    { href: "/clients", label: t("nav.clients") },
    { href: "/weekly", label: t("nav.weekly") },
    { href: "/reports", label: t("nav.reports") },
  ];
  const ownerNav = [{ href: "/dashboard", label: t("nav.dashboard") }];
  const isOwner = signedInUser?.role === "OWNER";
  const nav = isOwner ? [...publicNav, ...ownerNav] : publicNav;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b transition-[background-color,box-shadow,border-color] duration-200",
        scrolled
          ? "border-border bg-bg/85 backdrop-blur-md shadow-sm"
          : "border-transparent bg-bg/70 backdrop-blur-md",
      )}
    >
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-20 h-16 flex items-center gap-4">
        {/* Brand mark — T glyph (Tencent blue) as the sole wordmark */}
        <Link
          href="/"
          className="group flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md px-1 py-1"
          aria-label={t("nav.home.aria")}
        >
          <Image
            src="/t.svg"
            alt=""
            width={30}
            height={30}
          />
        </Link>

        <nav
          aria-label="Public navigation"
          className="hidden sm:flex items-center gap-0.5 ml-4"
        >
          {nav.map((n) => {
            const active =
              n.href === "/"
                ? pathname === "/"
                : pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-9 items-center rounded-lg px-3 text-sm transition-colors",
                  active
                    ? "text-fg"
                    : "text-fg-muted hover:text-fg hover:bg-bg-muted",
                )}
              >
                {n.label}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-[10px] h-0.5 rounded-full bg-accent"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LangToggle />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? t("nav.theme.light") : t("nav.theme.dark")}
            className="press inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-fg-muted hover:bg-bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
          >
            {dark ? (
              <Sun className="h-4 w-4" aria-hidden />
            ) : (
              <Moon className="h-4 w-4" aria-hidden />
            )}
          </button>

          {signedInUser ? (
            <>
              <Link
                href="/weekly/new"
                className="press hidden sm:inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-fg shadow-sm hover:bg-accent-hover hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {t("nav.add_update")}
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="press inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-fg-muted hover:text-fg hover:bg-bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={`${t("nav.sign_out")} ${signedInUser.email}`}
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{t("nav.sign_out")}</span>
              </button>
            </>
          ) : (
            <Suspense fallback={null}>
              <SignInDialog />
            </Suspense>
          )}
        </div>
      </div>
    </header>
  );
}
