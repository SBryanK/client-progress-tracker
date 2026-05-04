"use client";

import { useLang } from "@/components/lang-provider";

/**
 * Tiny inline translation component.
 *
 * Usage:
 *   <T id="home.cta.log" />
 *   <T id="home.cta.log" fallback="Log weekly update" />
 *
 * Renders the translation of the given key in the current language. The
 * optional `fallback` prop is shown during SSR (or if the key is missing)
 * so the server-rendered HTML is meaningful and there's no visual flash.
 */
export function T({ id, fallback }: { id: string; fallback?: string }) {
  const { t } = useLang();
  const value = t(id);
  // If t() returned the key itself (missing translation) and a fallback
  // was given, prefer the fallback so the UI stays legible.
  if (value === id && fallback !== undefined) return <>{fallback}</>;
  return <>{value}</>;
}
