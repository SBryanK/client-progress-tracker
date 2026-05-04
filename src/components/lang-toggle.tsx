"use client";

import { useLang } from "@/components/lang-provider";
import type { Lang } from "@/lib/i18n";

/**
 * Single-tap language toggle.
 *
 * ── Design ────────────────────────────────────────────────────────────
 * Compact pill that mirrors the macOS / Google-Translate convention: a
 * CJK-over-Latin glyph on the left, and on the right the character that
 * names the *other* language — i.e. what the user will switch to if
 * they click. No segmented control, no dropdown: one tap flips between
 * EN and 中文, the same affordance as the theme toggle next to it.
 *
 * When currently in English (EN):
 *   [🇦文  中]   ← tap flips to 中文
 *
 * When currently in Chinese (中文):
 *   [🇦文  EN]   ← tap flips to English
 *
 * The icon glyph ("文A") is drawn inline as SVG so it renders crisply
 * at any size and follows the surrounding text colour via
 * `currentColor` — no extra asset loading.
 */
export function LangToggle() {
  const { lang, setLang, t } = useLang();

  const next: Lang = lang === "en" ? "zh" : "en";
  // What we show on the right side of the pill is the name of the
  // *target* language — i.e. the language the user gets by tapping.
  const targetLabel = next === "zh" ? "中" : "EN";
  const ariaLabel =
    lang === "en" ? "切换到中文 · Switch to Chinese" : "Switch to English · 切换到英文";

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={ariaLabel}
      title={t("nav.language")}
      className="press inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-bg-muted px-2.5 text-fg-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
    >
      <TranslateGlyph className="h-4 w-4 shrink-0" />
      <span
        className={
          "text-xs font-semibold leading-none tabular-nums " +
          (next === "zh" ? "tracking-tight" : "tracking-wide")
        }
      >
        {targetLabel}
      </span>
    </button>
  );
}

/**
 * "文A" translate glyph, drawn inline so we don't need to ship an SVG
 * asset and so it inherits `currentColor`. The Hanzi "文" sits above a
 * lowercase "A" with a short underline tick on top of "文" — matching
 * the macOS system-wide "Translate" icon.
 */
function TranslateGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* Tick above 文, the classic Google-Translate touch */}
      <path d="M5 4h6" />
      {/* 文 character — rendered as glyph inside the SVG so it scales */}
      <text
        x="3"
        y="13"
        fontSize="11"
        fontFamily="'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif"
        fontWeight="600"
        fill="currentColor"
        stroke="none"
      >
        文
      </text>
      {/* A character — smaller, sitting lower-right, mimicking the
          multi-script pairing */}
      <text
        x="13"
        y="20"
        fontSize="10"
        fontFamily="-apple-system,'SF Pro Text','Helvetica Neue',sans-serif"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        A
      </text>
    </svg>
  );
}
