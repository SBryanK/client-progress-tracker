"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Lang } from "@/lib/i18n";
import { LANGS, t as translate } from "@/lib/i18n";

type LangContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const LangContext = createContext<LangContextValue | null>(null);

const STORAGE_KEY = "cp.lang";
const COOKIE_KEY = "cp.lang";
// 1 year — long enough to feel "permanent", short enough for stale
// browsers to eventually re-evaluate via the navigator.language fallback.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

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

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    // Cookie wins over localStorage so SSR (which only sees the cookie)
    // and the client agree. localStorage is kept as a fallback for
    // existing users who set their language before cookies were used.
    const cookieRaw = readCookie(COOKIE_KEY);
    if (cookieRaw && (LANGS as readonly string[]).includes(cookieRaw)) {
      return cookieRaw as Lang;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (LANGS as readonly string[]).includes(raw)) return raw as Lang;
    // Fall back to the browser language — `zh`, `zh-CN`, `zh-TW` → zh.
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("zh")) return "zh";
  } catch {
    /* noop */
  }
  return "en";
}

/**
 * Wrap the app (or any subtree) in a LangProvider to make the current
 * language and translation helper available via `useLang()`.
 */
export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Hydrate from cookie / localStorage on mount — keeps SSR output stable.
  useEffect(() => {
    setLangState(readInitialLang());
  }, []);

  // Reflect the current language on <html lang="…"> so screen-readers and
  // browser translation features pick it up correctly.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute(
      "lang",
      lang === "zh" ? "zh-CN" : "en",
    );
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* noop */
    }
    // Mirror to a cookie so a future server-side render (e.g. an
    // RSC layout that reads `cookies()`) can set the initial lang
    // without waiting for client hydration.
    writeCookie(COOKIE_KEY, l);
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      t: (key: string) => translate(key, lang),
    }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/**
 * Hook. Throws when called outside a LangProvider, which is a developer
 * error we want to catch loudly.
 */
export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error("useLang must be used inside <LangProvider>");
  }
  return ctx;
}
