"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A lightweight modal sign-in dialog used on the public landing page.
 *
 * It opens:
 *   • When the user clicks the "Sign in" button in the public header, OR
 *   • Automatically when the URL has ?signin=1 (set by middleware when an
 *     anonymous visitor hits a private route).
 *
 * On success, it pushes to `?next=...` if present, otherwise `/dashboard`.
 *
 * All accessibility musts are respected:
 *   - role="dialog" + aria-modal + aria-labelledby
 *   - focus moves to the email field on open
 *   - Escape closes
 *   - backdrop click closes
 *   - visible focus ring, labelled inputs, aria-invalid on error
 */
export function SignInDialog() {
  const router = useRouter();
  const params = useSearchParams();
  const autoOpen = params.get("signin") === "1";
  const next = params.get("next") ?? "/dashboard";

  const [open, setOpen] = useState(autoOpen);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);

  // Re-sync with URL param (middleware redirects land here with ?signin=1).
  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  // Focus management + ESC
  useEffect(() => {
    if (!open) return;
    emailRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    setError(null);
    // Strip the ?signin / ?next query params from the URL so the dialog
    // doesn't auto-reopen on refresh.
    if (params.get("signin") || params.get("next")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("signin");
      url.searchParams.delete("next");
      router.replace(url.pathname + (url.search ? url.search : ""));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      setLoading(false);
      if (!res) {
        setError("We couldn't reach the server. Check your connection and try again.");
        return;
      }
      if (res.error) {
        setError(
          "That email / password combination isn't right. Double-check both fields and try again.",
        );
        return;
      }
      router.push(next || "/dashboard");
      router.refresh();
    } catch {
      setLoading(false);
      setError("Something went wrong while signing in. Please try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Sign in
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signin-title"
        >
          <button
            type="button"
            aria-label="Close sign-in dialog"
            onClick={close}
            className="absolute inset-0 bg-fg/40 backdrop-blur-sm"
          />
          <div
            className={cn(
              "relative w-full max-w-md rounded-2xl border border-border bg-bg p-6 shadow-xl",
              "animate-in fade-in-0 zoom-in-95",
            )}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>

            <div className="mb-4">
              <h2 id="signin-title" className="text-xl font-semibold">
                Sign in to edit
              </h2>
              <p className="mt-1 text-sm text-fg-muted">
                The site is publicly viewable. Sign in to add or edit content.
              </p>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-3" aria-busy={loading}>
              <Input
                ref={emailRef}
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error ? (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                  <span>{error}</span>
                </div>
              ) : null}
              <Button type="submit" size="lg" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
              <p className="text-xs text-fg-subtle text-center">
                Only pre-authorized emails can sign in.
              </p>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
