"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { clearIdentity } from "@/components/identity-gate";

/**
 * Tiny "Reset identity" link that lets the user re-trigger the first-visit
 * gate without clearing all their browser data.
 *
 * It only renders if a stored preference exists, so the header doesn't
 * gain a useless button on a brand-new browser. We read the cookie
 * directly (cheap) on mount and on focus — that's enough to keep this
 * in sync after the gate has been completed in the same tab.
 */
const COOKIE_KEY = "cp.identity";
const STORAGE_KEY = "cp.identity";

function readIdentity(): string | null {
  if (typeof document === "undefined") return null;
  const target = `${COOKIE_KEY}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) {
      return decodeURIComponent(trimmed.slice(target.length)) || null;
    }
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function ResetIdentityButton() {
  const { t } = useLang();
  const [hasIdentity, setHasIdentity] = useState(false);

  useEffect(() => {
    const sync = () => setHasIdentity(Boolean(readIdentity()));
    sync();
    // Refresh when the tab regains focus — covers cross-tab gate
    // completion without polling.
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  if (!hasIdentity) return null;

  return (
    <button
      type="button"
      onClick={() => {
        clearIdentity();
        // Hard reload so the gate's mount-effect re-evaluates from
        // a clean slate.
        window.location.reload();
      }}
      aria-label={t("gate.reset")}
      title={t("gate.reset")}
      className="press inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-fg-muted hover:bg-bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
    >
      <RotateCcw className="h-4 w-4" aria-hidden />
    </button>
  );
}
