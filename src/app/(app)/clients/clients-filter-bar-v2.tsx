"use client";

import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import type { StatusBucket } from "@/lib/status";
import { STATUS_BUCKETS } from "@/lib/status";

/**
 * Modern segmented filter bar used on the All-clients page.
 *
 * Design choices:
 *  • One unified pill container — reads as a single segmented control,
 *    matches macOS/SF affordances.
 *  • Active segment has a solid "inset" pill; inactive segments stay
 *    borderless but animate on hover.
 *  • Each segment shows its count in a muted sibling span so the user can
 *    scan the pipeline at a glance without opening the dashboard.
 *  • Keyboard-navigable via normal tabbing — uses <Link> under the hood so
 *    deep-linking still works ("/clients?bucket=ASSIST").
 *  • Akamai is now first-class in STATUS_BUCKETS (May 2026 4-bucket
 *    redesign), so it no longer needs a separate orthogonal segment.
 *    The `group=akamai` URL param still resolves on the page via
 *    aliasBucket() for backwards-compat with bookmarks.
 */
export function ClientsFilterBar({
  active,
  totalCount,
  bucketCounts,
}: {
  active: StatusBucket | null;
  totalCount: number;
  bucketCounts: Record<StatusBucket, number>;
}) {
  const { t } = useLang();

  const segments: Array<{
    key: "ALL" | StatusBucket;
    label: string;
    href: string;
    count: number;
    isActive: boolean;
  }> = [
    {
      key: "ALL",
      label: t("clients.filter_all"),
      // Explicit `?bucket=ALL` because the bare `/clients` path now
      // defaults to PRIMARY — we need a dedicated value to opt back
      // into the unfiltered view.
      href: "/clients?bucket=ALL",
      count: totalCount,
      isActive: active === null,
    },
    ...STATUS_BUCKETS.map((b) => ({
      key: b,
      label: t(`bucket.${b}`),
      href: `/clients?bucket=${b}`,
      count: bucketCounts[b],
      isActive: active === b,
    })),
  ];
  return (
    <nav
      aria-label={t("clients.filter_aria")}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-subtle/60 p-1 shadow-inner-soft max-w-full overflow-x-auto no-scrollbar"
    >
      {segments.map((s) => (
        <Link
          key={s.key}
          href={s.href}
          aria-current={s.isActive ? "page" : undefined}
          className={
            "press group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 " +
            (s.isActive
              ? "bg-bg text-fg shadow-sm ring-1 ring-border-strong"
              : "text-fg-muted hover:text-fg hover:bg-bg/60")
          }
        >
          <span>{s.label}</span>
          <span
            aria-hidden
            className={
              "tabular-nums text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center transition-colors " +
              (s.isActive
                ? "bg-accent/12 text-accent"
                : "bg-bg-muted text-fg-subtle group-hover:bg-bg-subtle")
            }
          >
            {s.count}
          </span>
        </Link>
      ))}
    </nav>
  );
}
