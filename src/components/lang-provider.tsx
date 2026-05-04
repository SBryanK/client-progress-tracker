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

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
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

  // Hydrate from localStorage on mount — keeps SSR output stable.
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
