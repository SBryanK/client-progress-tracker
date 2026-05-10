import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnerIds } from "@/lib/public";
import { Card } from "@/components/ui/card";
import { StatusBucketBadge } from "@/components/status-badge";
import { T } from "@/components/t";
import {
  STATUS_BUCKETS,
  toStatusBucket,
  type StatusBucket,
} from "@/lib/status";
import { formatWeekRange } from "@/lib/week";
import { AIAssistant } from "@/components/ai-assistant";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await auth();
  const isOwner = session?.user?.role === "OWNER";

  const ownerIds = await getOwnerIds();
  const ownerFilter = ownerIds.length ? { in: ownerIds } : { in: ["__none__"] };

  const [clients, latestUpdates] = await Promise.all([
    prisma.client.findMany({
      where: { ownerId: ownerFilter, archived: false },
      select: { id: true, status: true },
    }),
    prisma.weeklyUpdate.findMany({
      where: { client: { ownerId: ownerFilter, archived: false } },
      include: { client: true },
      orderBy: { weekStart: "desc" },
      take: 6,
    }),
  ]);

  const bucketCounts = Object.fromEntries(
    STATUS_BUCKETS.map((b) => [b, 0]),
  ) as Record<StatusBucket, number>;
  for (const c of clients) {
    bucketCounts[toStatusBucket(c.status)] += 1;
  }

  return (
    <div className="flex flex-col gap-12 sm:gap-14">
      {/* ═══ Hero ═══════════════════════════════════════════════════════ */}
      <section
        aria-labelledby="hero-title"
        className="hero-wash relative -mx-4 sm:-mx-6 lg:-mx-10 xl:-mx-14 2xl:-mx-20 px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-20 pt-10 pb-10 rounded-3xl"
      >
        <div className="relative max-w-5xl animate-rise-in">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-bg/70 backdrop-blur px-3 py-1 text-[11px] font-medium text-fg-muted uppercase tracking-[0.12em] shadow-xs">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-ring" />
            <T id="hero.eyebrow" fallback="Client Progress Tracker" />
          </p>
          <h1
            id="hero-title"
            className="mt-4 text-3xl leading-[1.05] sm:text-4xl lg:text-5xl font-semibold tracking-tight text-balance font-display"
          >
            <T id="hero.title.prefix" fallback="Weekly Client Progress, " />{" "}
            <span className="text-gradient whitespace-nowrap">
              Bryan 郭檍祥
            </span>
          </h1>
          <div className="mt-7 flex flex-wrap gap-3">
            {isOwner ? (
              <Link
                href="/weekly/new"
                className="press inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-accent-fg shadow-md hover:bg-accent-hover hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <Plus className="h-4 w-4" aria-hidden />
                <T id="home.cta.log" fallback="Log weekly update" />
              </Link>
            ) : null}
            <Link
              href="/clients"
              className={`press inline-flex h-12 items-center gap-2 rounded-xl px-6 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                isOwner
                  ? "bg-bg border border-border hover:bg-bg-muted hover:border-border-strong"
                  : "bg-accent text-accent-fg shadow-md hover:bg-accent-hover hover:shadow-lg"
              }`}
            >
              <T id="home.cta.browse" fallback="Browse clients" />
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/weekly"
              className="press inline-flex h-12 items-center rounded-xl px-5 text-sm font-medium text-fg-muted hover:text-fg hover:bg-bg-muted transition-colors"
            >
              <T id="home.cta.timeline" fallback="Open timeline →" />
            </Link>
            <Link
              href="/reports"
              className="press inline-flex h-12 items-center rounded-xl px-5 text-sm font-medium text-fg-muted hover:text-fg hover:bg-bg-muted transition-colors"
            >
              <T id="home.cta.report" fallback="Download report →" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ Stats row ═══════════════════════════════════════════════════════ */}
      <section
        aria-label="Pipeline snapshot"
        className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 stagger animate-fade-up"
      >
        <StatCard
          labelKey="stat.total"
          label="Total clients"
          value={clients.length}
          sublabelKey="stat.total.sub"
          sublabel="Tracked across all statuses"
        />
        <StatCard
          labelKey="stat.active"
          label="Active"
          value={bucketCounts.ACTIVE}
          tone="success"
          sublabelKey="stat.active.sub"
          sublabel="Currently moving"
        />
        <StatCard
          labelKey="stat.onwork"
          label="On-work"
          value={bucketCounts.ON_WORK}
          tone="purple"
          sublabelKey="stat.onwork.sub"
          sublabel="Deep engagement · priority"
        />
        <StatCard
          labelKey="stat.ongoing"          label="On-work"
          value={bucketCounts.ON_WORK}
          tone="purple"
          sublabelKey="stat.onwork.sub"
          sublabel="Deep engagement · priority"
        />
        <StatCard
          labelKey="stat.ongoing"
          label="On-going"
          value={bucketCounts.ON_GOING}
          tone="info"
          sublabelKey="stat.ongoing.sub"
          sublabel="Long-running / in-flight"
        />
        <StatCard
          labelKey="stat.idle"
          label="Idle"
          value={bucketCounts.IDLE}
          tone="warning"
          sublabelKey="stat.idle.sub"
          sublabel="Paused / low priority"
        />
      </section>
      {/* ═══ Recent updates ═════════════════════════════ */}
      <section aria-label="Recent updates" className="animate-fade-up">
        <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight font-display">              <T id="recent.title" fallback="Recent updates" />
            </h2>
            <p className="mt-1 text-sm text-fg-muted font-description">
              <T
                id="recent.sub"
                fallback="The most recent weekly logs across all clients."
              />
            </p>
          </div>
          <Link
            href="/weekly"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            <T id="recent.open_timeline" fallback="Open timeline" />
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>

        {latestUpdates.length === 0 ? (
          <Card>
            <p className="text-sm text-fg-muted">
              <T id="recent.empty" fallback="No weekly updates yet." />
            </p>
          </Card>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 stagger">
            {latestUpdates.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/clients/${u.client.slug}`}
                  className="card-hover block rounded-2xl border border-border/50 bg-gradient-to-br from-bg to-bg-subtle p-5 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent h-full transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold truncate text-fg font-display">
                      {u.client.name}
                    </p>
                    <StatusBucketBadge
                      bucket={toStatusBucket(u.status ?? u.client.status)}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-fg-subtle font-mono">
                    {u.weekLabel || formatWeekRange(u.weekStart)}
                  </p>
                  <p className="mt-3 text-sm prose-entry text-fg-muted line-clamp-4 break-words font-description">
                    {u.bullets}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ═══ AI Assistant (bottom) ═══════════════════════════════════════ */}
      <AIAssistant />
    </div>
  );
}

function StatCard({
  label,
  labelKey,
  value,
  tone = "neutral",
  sublabel,
  sublabelKey,
}: {
  label: string;
  labelKey?: string;
  value: number;
  tone?: "neutral" | "info" | "success" | "warning" | "purple";
  sublabel?: string;
  sublabelKey?: string;
}) {
  // Entire card tinted (bold), not just the top bar.
  const toneCard = {
    neutral:
      "border-border/50 bg-gradient-to-br from-bg to-bg-subtle",
    info:
      "border-sky-400 bg-gradient-to-br from-sky-200 to-sky-300 dark:from-sky-500/40 dark:to-sky-600/25 dark:border-sky-400/50",
    success:
      "border-emerald-400 bg-gradient-to-br from-emerald-200 to-emerald-300 dark:from-emerald-500/40 dark:to-emerald-600/25 dark:border-emerald-400/50",
    warning:
      "border-amber-400 bg-gradient-to-br from-amber-200 to-amber-300 dark:from-amber-500/40 dark:to-amber-600/25 dark:border-amber-400/50",
    purple:
      "border-purple-400 bg-gradient-to-br from-purple-200 to-purple-300 dark:from-purple-500/40 dark:to-purple-600/25 dark:border-purple-400/50",
  }[tone];
  const toneLabel = {
    neutral: "text-fg-subtle",
    info: "text-sky-900 dark:text-sky-200",
    success: "text-emerald-900 dark:text-emerald-200",
    warning: "text-amber-900 dark:text-amber-200",
    purple: "text-purple-900 dark:text-purple-200",
  }[tone];
  const toneValue = {
    neutral: "text-fg",
    info: "text-sky-950 dark:text-sky-50",
    success: "text-emerald-950 dark:text-emerald-50",
    warning: "text-amber-950 dark:text-amber-50",
    purple: "text-purple-950 dark:text-purple-50",
  }[tone];
  const toneSub = {
    neutral: "text-fg-subtle",
    info: "text-sky-800/85 dark:text-sky-200/85",
    success: "text-emerald-800/85 dark:text-emerald-200/85",
    warning: "text-amber-800/85 dark:text-amber-200/85",
    purple: "text-purple-800/85 dark:text-purple-200/85",
  }[tone];
  return (
    <div
      className={`card-hover group relative overflow-hidden rounded-2xl border p-5 shadow-sm ${toneCard}`}
    >
      <p
        className={`relative text-[11px] uppercase tracking-[0.08em] font-semibold font-description ${toneLabel}`}
      >
        {labelKey ? <T id={labelKey} fallback={label} /> : label}
      </p>
      <p
        className={`relative mt-3 text-4xl font-semibold tabular-nums tracking-tight font-display ${toneValue}`}
      >
        {value}
      </p>
      {sublabel ? (
        <p className={`relative mt-1 text-xs truncate font-description ${toneSub}`}>
          {sublabelKey ? <T id={sublabelKey} fallback={sublabel} /> : sublabel}
        </p>
      ) : null}
    </div>
  );
}
