"use client";

import { differenceInCalendarISOWeeks, startOfISOWeek } from "date-fns";
import { useEffect, useState } from "react";
import { useLang } from "@/components/lang-provider";

/**
 * Tiny client component that renders the "Last update …" subtitle on each
 * client card.
 *
 * ── Why weeks, not hours ──────────────────────────────────────────────
 * The tracker's unit of work is the ISO week. A weekly log written on
 * Monday morning and one written on Friday evening are both "this week"
 * — they should read the same way. Showing "2 hours ago" vs "4 days ago"
 * for the same conceptual week is noisy and inaccurate to how Bryan
 * actually works.
 *
 * We therefore bucket the distance by the number of ISO weeks between
 * the signal and "now":
 *
 *   Δ ≤ 0  → "Updated this week"   / 本周已更新
 *   Δ = 1  → "Updated last week"   / 上周更新
 *   2‑8    → "Updated N weeks ago" / N 周前更新
 *   9‑25   → "Updated about N months ago" (fallback — still no hours)
 *   > 25   → "Updated over a year ago"
 *
 * Future-dated signals (Δ < 0, e.g. an activity with a scheduled
 * occurredOn next week) are clamped to "this week" rather than showing
 * a nonsensical negative label.
 *
 * ── SSR / hydration ───────────────────────────────────────────────────
 * The calculation is purely a function of `iso` and "now", so running
 * it on the server and again on the client produces the same string
 * within a request — no hydration mismatch. We still swap to the
 * localized copy after mount so users who pick 中文 see the Chinese
 * phrasing without waiting for a round-trip.
 */
export function ClientLastUpdateLabel({
  iso,
  hasUpdate,
}: {
  iso: string;
  hasUpdate: boolean;
}) {
  const { t, lang } = useLang();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!hasUpdate) {
    const msg = mounted ? t("clients.no_update") : "No weekly update yet";
    return <p className="text-xs text-fg-subtle">{msg}</p>;
  }

  const signal = new Date(iso);
  const label = weekDistanceLabel(signal, new Date(), mounted ? lang : "en");

  return <p className="text-xs text-fg-subtle">{label}</p>;
}

/**
 * Bucket the distance between `signal` and `now` into a week-based
 * human label. Exported for unit testing if needed later.
 */
function weekDistanceLabel(
  signal: Date,
  now: Date,
  lang: "en" | "zh",
): string {
  // Compare at the week boundary — two dates in the same ISO week are
  // "0 weeks apart", regardless of the day-of-week they fall on.
  const diff = Math.max(
    0,
    differenceInCalendarISOWeeks(
      startOfISOWeek(now),
      startOfISOWeek(signal),
    ),
  );

  if (lang === "zh") {
    if (diff === 0) return "本周已更新";
    if (diff === 1) return "上周更新";
    if (diff <= 8) return `${diff} 周前更新`;
    const months = Math.round(diff / 4.345);
    if (months < 12) return `约 ${months} 个月前更新`;
    return "一年多前更新";
  }

  if (diff === 0) return "Updated this week";
  if (diff === 1) return "Updated last week";
  if (diff <= 8) return `Updated ${diff} weeks ago`;
  const months = Math.round(diff / 4.345);
  if (months < 12) return `Updated about ${months} months ago`;
  return "Updated over a year ago";
}
