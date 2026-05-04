"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  FileText,
  Upload,
  Link2,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; ownerOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/weekly", label: "Weekly updates", icon: CalendarClock },
  { href: "/reports", label: "Reports", icon: FileText, ownerOnly: true },
  { href: "/import", label: "Import", icon: Upload, ownerOnly: true },
  { href: "/dashboard/share", label: "Share links", icon: Link2, ownerOnly: true },
];

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; role: "OWNER" | "VIEWER" };
}) {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

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

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[240px_1fr]">
      {/* Sidebar */}
      <aside className="border-b md:border-b-0 md:border-r border-border bg-bg-subtle/60 p-4 md:p-6 md:min-h-screen">
        <div className="flex items-center justify-between md:block">
          <Link href="/dashboard" className="block">
            <p className="text-base font-semibold leading-tight">Client Tracker</p>
            <p className="text-xs text-fg-muted">Weekly progress</p>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="md:mt-4 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-bg-muted"
          >
            {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
          </button>
        </div>

        <nav aria-label="Main" className="mt-4 md:mt-6 flex md:block gap-1 overflow-x-auto">
          {NAV.filter((n) => !n.ownerOnly || user.role === "OWNER").map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex md:flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm",
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-fg-muted hover:bg-bg-muted hover:text-fg",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 hidden md:block">
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium truncate">{user.name}</p>
            <p className="text-xs text-fg-muted truncate">{user.email}</p>
            <p className="mt-1 inline-flex items-center rounded-md bg-bg-muted px-1.5 py-0.5 text-xs font-medium text-fg-muted">
              {user.role === "OWNER" ? "Owner" : "Viewer"}
            </p>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
