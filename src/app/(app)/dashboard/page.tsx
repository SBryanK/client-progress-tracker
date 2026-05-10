import Link from "next/link";
import { redirect } from "next/navigation";
import { subDays, formatDistanceToNow } from "date-fns";
import { Plus, Clock, Activity, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOwnerIds } from "@/lib/public";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBucketBadge } from "@/components/status-badge";
import {
  STATUS_BUCKETS,
  STATUS_BUCKET_LABEL,
  toStatusBucket,
  type StatusBucket,
} from "@/lib/status";
import { formatWeekRange } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    redirect("/?signin=1&next=/dashboard");
  }
  const ownerIds = await getOwnerIds();
  const ownerFilter = ownerIds.length ? { in: ownerIds } : { in: ["__none__"] };

  const [clients, latestUpdates] = await Promise.all([
    prisma.client.findMany({
      where: { ownerId: ownerFilter, archived: false },
      include: {
        weeklyUpdates: { orderBy: { weekStart: "desc" }, take: 1 },
      },
    }),
    prisma.weeklyUpdate.findMany({
      where: { client: { ownerId: ownerFilter, archived: false } },
      include: { client: true },
      orderBy: { weekStart: "desc" },
      take: 8,
    }),
  ]);

  const bucketCounts = Object.fromEntries(
    STATUS_BUCKETS.map((b) => [b, 0]),
  ) as Record<StatusBucket, number>;
  for (const c of clients) bucketCounts[toStatusBucket(c.status)] += 1;

  // Clients whose last update is older than 14 days (or have none yet).
  // All three buckets are actively tracked — no exclusions.
  const staleThreshold = subDays(new Date(), 14);
  const stale = clients
    .filter((c) => {
      const last = c.weeklyUpdates[0];
      return !last || last.weekStart < staleThreshold;
    })
    .sort((a, b) => {
      const la = a.weeklyUpdates[0]?.weekStart.getTime() ?? 0;
      const lb = b.weeklyUpdates[0]?.weekStart.getTime() ?? 0;
      return la - lb;
    })
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      {/* ═══ Header ═══════════════════════════════════════════════════ */}
      <header className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent">
            <Activity className="h-3 w-3" aria-hidden />
            Owner dashboard
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight font-display">
            Pulse check
          </h1>
          <p className="mt-1.5 text-sm text-fg-muted font-description">
            Quick pulse of every client, this week&apos;s updates, and what
            needs attention.
          </p>
        </div>
        <Link
          href="/weekly/new"
          className="press inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-fg shadow-md hover:bg-accent-hover hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Log weekly update
        </Link>
      </header>

      {/* ═══ Stats ════════════════════════════════════════════════════════════ */}
      <section
        aria-label="Stats"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 stagger"
      >
        <StatCard label="Total clients" value={clients.length} />
        <StatCard
          label="Active"
          value={bucketCounts.ACTIVE}
          tone="success"
        />
        <StatCard
          label="On-work"
          value={bucketCounts.ON_WORK}
          tone="purple"
        />
        <StatCard
          label="On-going"
          value={bucketCounts.ON_GOING}
          tone="info"
        />
        <StatCard
          label="Idle"
          value={bucketCounts.IDLE}
          tone="warning"
        />
      </section>
      {/* ═══ Buckets ════════════════════════════════════════════════════════════════ */}
      <section aria-label="Status distribution" className="animate-fade-up">
        <div className="flex items-baseline justify-between gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight font-display">Pipeline</h2>
            <p className="mt-0.5 text-sm text-fg-muted font-description">
              Four buckets, click to drill in.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">          {STATUS_BUCKETS.map((b) => {
            const count = bucketCounts[b];
            const pct =
              clients.length > 0
                ? Math.round((count / clients.length) * 100)
                : 0;
            return (
              <Link
                key={b}
                href={`/clients?bucket=${b}`}
                className="card-hover press group rounded-2xl border border-border/50 bg-gradient-to-br from-bg to-bg-subtle p-5 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all"
              >
                <div className="flex items-center justify-between">
                  <StatusBucketBadge bucket={b} />
                  <span className="text-[11px] tabular-nums text-fg-subtle font-description">
                    {pct}%
                  </span>
                </div>
                <p className="mt-4 text-3xl font-semibold tabular-nums font-display">
                  {count}
                </p>
                <p className="mt-1 text-xs text-fg-subtle font-description">
                  {STATUS_BUCKET_LABEL[b]}
                </p>
                <div className="mt-3 h-1 w-full rounded-full bg-bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ═══ Stale + Latest ═══════════════════════════════════════════ */}
      <section
        aria-label="Needs an update & latest"
        className="grid gap-6 lg:grid-cols-2"
      >
        <Card className="bg-gradient-to-br from-bg to-bg-subtle">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle as="h2" className="font-display">
                <span className="inline-flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-warning/10 text-warning">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  Needs an update
                </span>
              </CardTitle>
              <CardDescription className="font-description">
                Clients without a weekly log in the last 14 days.
              </CardDescription>
            </div>
            <Link
              href="/clients"
              className="text-sm text-accent hover:underline inline-flex items-center gap-1 font-description"
            >
              See all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          {stale.length === 0 ? (
            <p className="mt-4 text-sm text-fg-muted font-description">
              Everyone has a recent update — nice work.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border/50">
              {stale.map((c) => {
                const last = c.weeklyUpdates[0];
                return (
                  <li
                    key={c.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <Link
                      href={`/clients/${c.slug}`}
                      className="min-w-0 flex-1 hover:underline"
                    >
                      <p className="font-medium truncate font-display">{c.name}</p>
                      <p className="text-xs text-fg-muted font-description">
                        {last
                          ? `Last update ${formatDistanceToNow(last.weekStart, { addSuffix: true })}`
                          : "No weekly update yet"}
                      </p>
                    </Link>
                    <StatusBucketBadge bucket={toStatusBucket(c.status)} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="bg-gradient-to-br from-green-50/40 to-green-100/30 border-green-200/60">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle as="h2" className="font-display">Latest weekly updates</CardTitle>
              <CardDescription className="font-description">
                The most recent bullet logs across all clients.
              </CardDescription>
            </div>
            <Link
              href="/weekly"
              className="text-sm text-accent hover:underline inline-flex items-center gap-1 font-description"
            >
              Timeline <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          {latestUpdates.length === 0 ? (
            <p className="mt-4 text-sm text-fg-muted font-description">
              No weekly updates yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {latestUpdates.map((u) => (
                <li
                  key={u.id}
                  className="card-hover rounded-xl border border-green-200/40 bg-green-50/30 p-3 hover:bg-green-50/50 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/clients/${u.client.slug}`}
                      className="font-medium truncate hover:underline font-display"
                    >
                      {u.client.name}
                    </Link>
                    <span className="text-xs text-fg-subtle font-mono">
                      {u.weekLabel || formatWeekRange(u.weekStart)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-fg-muted prose-entry line-clamp-3 font-description">
                    {u.bullets}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "info" | "success" | "warning" | "purple";
}) {
  const accentBar = {
    neutral: "bg-fg-subtle/30",
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
    purple: "bg-purple-500",
  }[tone];
  
  const bgGradient = {
    neutral: "bg-gradient-to-br from-bg to-bg-subtle",
    info: "bg-gradient-to-br from-blue-50/30 to-blue-100/20",
    success: "bg-gradient-to-br from-green-50/30 to-green-100/20",
    warning: "bg-gradient-to-br from-amber-50/30 to-amber-100/20",
    purple: "bg-gradient-to-br from-purple-50/40 to-purple-100/30 dark:from-purple-500/10 dark:to-purple-600/5",
  }[tone];
  
  const borderColor = {
    neutral: "border-border",
    info: "border-blue-200/50",
    success: "border-green-200/50",
    warning: "border-amber-200/50",
    purple: "border-purple-300/60 dark:border-purple-400/30",
  }[tone];
  
  return (
    <div className={`card-hover relative overflow-hidden rounded-2xl border ${borderColor} ${bgGradient} p-5 shadow-sm`}>
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-0.5 ${accentBar}`}
      />
      <p className="text-xs uppercase tracking-wider text-fg-subtle font-description">{label}</p>
      <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight font-display">
        {value}
      </p>
    </div>
  );
}
