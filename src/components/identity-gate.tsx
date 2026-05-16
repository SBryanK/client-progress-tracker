"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { useLang } from "@/components/lang-provider";

/**
 * First-visit identity gate.
 *
 * The first time a browser opens the app it sees a single, friendly
 * chooser asking "Are you visiting, or do you own this tracker?".
 *
 *   • Visitor → dismiss the overlay; the underlying public page renders
 *     unchanged. The choice is persisted to a 1-year cookie + localStorage
 *     so future visits go straight in.
 *   • Owner   → persist the choice and redirect into the existing
 *     sign-in dialog (`?signin=1&next=/dashboard`).
 *
 * The gate must never block an in-flight auth redirect: if the URL
 * already has `?signin=1`, or if a NextAuth session exists, the gate
 * stays hidden. ESC closes to the safe-default visitor branch.
 */

const STORAGE_KEY = "cp.identity";
const COOKIE_KEY = "cp.identity";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // ~1 year

type Identity = "visitor" | "owner";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const target = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) {
      return decodeURIComponent(trimmed.slice(target.length));
    }
  }
  return null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

function readStoredIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  // Cookie wins over localStorage so SSR (which only sees the cookie)
  // and the client agree once the gate has been completed.
  const fromCookie = readCookie(COOKIE_KEY);
  if (fromCookie === "visitor" || fromCookie === "owner") return fromCookie;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "visitor" || raw === "owner") return raw;
  } catch {
    /* noop */
  }
  return null;
}

export function persistIdentity(value: Identity) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* noop */
  }
  writeCookie(COOKIE_KEY, value);
}

/**
 * Imperatively clear both stores. Wired to the "Reset identity" action
 * inside the language-toggle menu so users can re-trigger the gate
 * without clearing their entire browser data.
 */
export function clearIdentity() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
  // Expire the cookie immediately.
  if (typeof document !== "undefined") {
    document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; samesite=lax`;
  }
}

export function IdentityGate() {
  const { t } = useLang();
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const visitorBtnRef = useRef<HTMLButtonElement | null>(null);

  // Decide whether to show the gate on mount. We intentionally read
  // window.location here (not next/navigation) so this runs without a
  // SearchParamsContext when the gate is mounted at the very top of the
  // tree, including for share-link routes.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. URL already mid-auth — never block the in-flight redirect.
    const params = new URLSearchParams(window.location.search);
    if (params.has("signin") || params.has("next")) return;

    // 2. A live NextAuth session — the user is already authenticated;
    //    no point asking them to identify themselves again.
    if (status === "authenticated") return;
    if (status === "loading") return;

    // 3. Stored preference — they've chosen before, respect it.
    if (readStoredIdentity()) return;

    setOpen(true);
  }, [status]);

  // Initial focus + ESC handler. ESC closes to the visitor branch as a
  // safe default so the gate never traps the user.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    visitorBtnRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        chooseVisitor();
      } else if (e.key === "Tab") {
        // Minimal focus trap — ping-pong between the two buttons.
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          "button, [href], [tabindex]:not([tabindex='-1'])",
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    // Lock body scroll while the gate is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const chooseVisitor = useCallback(() => {
    persistIdentity("visitor");
    setOpen(false);
  }, []);

  const chooseOwner = useCallback(() => {
    persistIdentity("owner");
    // Bounce into the existing sign-in dialog. We use a hard navigation
    // so middleware re-evaluates and ?signin=1 is honoured everywhere.
    const next = window.location.pathname.startsWith("/dashboard")
      ? "/dashboard"
      : "/dashboard";
    window.location.href = `/?signin=1&next=${encodeURIComponent(next)}`;
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="identity-gate-title"
      aria-describedby="identity-gate-desc"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm animate-fade-up"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl rounded-3xl border border-border bg-bg p-7 sm:p-9 shadow-2xl"
      >
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
            {t("gate.eyebrow")}
          </p>
          <h2
            id="identity-gate-title"
            className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-fg font-display"
          >
            {t("gate.title")}
          </h2>
          <p
            id="identity-gate-desc"
            className="mt-2 text-sm text-fg-muted leading-relaxed font-description max-w-md mx-auto"
          >
            {t("gate.subtitle")}
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {/* Bryan / owner card */}
          <button
            type="button"
            onClick={chooseOwner}
            className="press group relative rounded-2xl border-2 border-accent/30 bg-gradient-to-br from-accent-soft/60 to-bg p-5 text-left hover:border-accent hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-lg font-bold text-accent-fg shadow-sm">
                B
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-fg font-display">
                  {t("gate.owner_card_title")}
                </p>
                <p className="mt-0.5 text-xs text-fg-muted font-description">
                  {t("gate.owner_card_body")}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold text-accent group-hover:translate-x-0.5 transition-transform">
              {t("gate.owner_cta")}
            </p>
          </button>

          {/* Visitor card */}
          <button
            ref={visitorBtnRef}
            type="button"
            onClick={chooseVisitor}
            className="press group relative rounded-2xl border-2 border-border bg-bg p-5 text-left hover:border-border-strong hover:bg-bg-muted/40 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-bg-muted text-lg" aria-hidden>
                👤
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-fg font-display">
                  {t("gate.visitor_card_title")}
                </p>
                <p className="mt-0.5 text-xs text-fg-muted font-description">
                  {t("gate.visitor_card_body")}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold text-fg-muted group-hover:text-fg group-hover:translate-x-0.5 transition-all">
              {t("gate.visitor_cta")}
            </p>
          </button>
        </div>

        <p className="mt-6 text-xs text-fg-subtle text-center font-description">
          {t("gate.helper")}
        </p>
      </div>
    </div>
  );
}
