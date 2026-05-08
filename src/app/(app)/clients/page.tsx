import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOwnerIds } from "@/lib/public";
import { Card } from "@/components/ui/card";
import { StatusBucketBadge } from "@/components/status-badge";
import { T } from "@/components/t";
import { ClientsFilterBar } from "./clients-filter-bar-v2";
import { ClientLastUpdateLabel } from "./client-last-update-label";
import {
  STATUS_BUCKETS,
  STATUS_BUCKET_LABEL,
  BUCKET_TO_STATUSES,
  toStatusBucket,
  type StatusBucket,
} from "@/lib/status";
import { NewClientButton } from "./new-client-button";

export const dynamic = "force-dynamic";

type SearchParams = {
  bucket?: string;
};

export default async function AllClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const isOwner = session?.user?.role === "OWNER";
  const ownerIds = await getOwnerIds();

  const sp = await searchParams;
  const bucketFilter =
    sp.bucket && (STATUS_BUCKETS as readonly string[]).includes(sp.bucket)
      ? (sp.bucket as StatusBucket)
      : undefined;

  const baseWhere: Prisma.ClientWhereInput = {
    ownerId: ownerIds.length ? { in: ownerIds } : { in: ["__none__"] },
    archived: false,
  };

  const where: Prisma.ClientWhereInput = {
    ...baseWhere,
    ...(bucketFilter
      ? { status: { in: BUCKET_TO_STATUSES[bucketFilter] } }
      : {}),
  };

  // We fetch every client's latest weekly update AND latest activity —
  // ordered by the *work date* (weekStart / occurredOn), NOT by the row's
  // updatedAt. When data is imported or backfilled in bulk, updatedAt
  // points at "now" for every row, which would otherwise make the
  // latest-edited row win even if it describes older work.
  const clients = await prisma.client.findMany({
    where,
    include: {
      weeklyUpdates: {
        orderBy: { weekStart: "desc" },
        take: 1,
        select: { id: true, weekStart: true, updatedAt: true, createdAt: true },
      },
      activities: {
        orderBy: { occurredOn: "desc" },
        take: 1,
        select: {
          id: true,
          occurredOn: true,
          updatedAt: true,
          createdAt: true,
        },
      },
    },
  });

  // For the bucket count pills — query once across the entire (unfiltered)
  // set so the filter chips can show "Active · 9", "On-going · 3" etc.
  const allForCounts = await prisma.client.findMany({
    where: baseWhere,
    select: { status: true },
  });
  const bucketCounts = Object.fromEntries(
    STATUS_BUCKETS.map((b) => [b, 0]),
  ) as Record<StatusBucket, number>;
  for (const c of allForCounts) bucketCounts[toStatusBucket(c.status)] += 1;
  const totalCount = allForCounts.length;

  // Rank each client by the date of the *work it describes*, not by the
  // DB row's updatedAt. When historical weeks are imported in bulk,
  // every row's createdAt/updatedAt is "today" — which incorrectly
  // collapses every client to "Updated this week".
  //
  // We therefore prefer the work-date fields:
  //   • weeklyUpdate.weekStart  (the Monday of the week being logged)
  //   • activity.occurredOn     (the actual day of the engagement)
  //
  // …and only fall back to createdAt / client.updatedAt if neither
  // work-date is present on any child row (a genuinely-new empty client).
  function lastSignal(c: (typeof clients)[number]): Date {
    const workDates: Date[] = [];
    for (const w of c.weeklyUpdates) {
      if (w.weekStart) workDates.push(w.weekStart);
    }
    for (const a of c.activities) {
      if (a.occurredOn) workDates.push(a.occurredOn);
    }
    if (workDates.length > 0) {
      return new Date(Math.max(...workDates.map((d) => d.getTime())));
    }
    // No weekly update or activity has a work-date → fall back to when
    // the client record itself was last touched.
    return c.updatedAt;
  }
  const rows = clients
    .map((c) => ({ c, last: lastSignal(c) }))
    .sort((a, b) => b.last.getTime() - a.last.getTime());

  return (
    <div className="flex flex-col gap-8">
      {/* ═══ Header ═══════════════════════════════════════════════════ */}
      <header className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight font-display">
            <T id="clients.title" fallback="All clients" />
          </h1>
          {bucketFilter ? (
            <p className="mt-1.5 text-sm text-fg-muted font-description">
              <T id="clients.showing" fallback="Showing" />{" "}
              <span className="font-medium text-fg">
                <T
                  id={`bucket.${bucketFilter}`}
                  fallback={STATUS_BUCKET_LABEL[bucketFilter]}
                />
              </span>
              {" · "}
              <Link href="/clients" className="text-accent hover:underline">
                <T id="clients.clear" fallback="clear" />
              </Link>
            </p>
          ) : null}
        </div>
        {isOwner ? <NewClientButton /> : null}
      </header>

      {/* ═══ Modern segmented filter bar w/ bucket counts ═══════════════ */}
      <ClientsFilterBar
        active={bucketFilter ?? null}
        totalCount={totalCount}
        bucketCounts={bucketCounts}
      />

      {/* ═══ List ═══════════════════════════════════════════════════════ */}
      {rows.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 text-center py-10">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-bg-muted text-fg-subtle">
              <Users className="h-6 w-6" aria-hidden />
            </div>
            <p className="text-sm text-fg-muted max-w-xs">
              <T
                id="clients.empty"
                fallback="No clients in this bucket yet."
              />
              {isOwner ? (
                <>
                  {" "}
                  <Link
                    href="/clients/new"
                    className="text-accent hover:underline font-medium"
                  >
                    <T id="clients.add_link" fallback="Add a client →" />
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 stagger">
          {rows.map(({ c, last }) => {
            const bucket = toStatusBucket(c.status);
            // Full-box tint per bucket — bold saturation (clearly visible).
            const bucketCard = {
              ACTIVE:
                "border-emerald-400 bg-gradient-to-br from-emerald-200 to-emerald-300 dark:from-emerald-500/40 dark:to-emerald-600/25 dark:border-emerald-400/50",
              ON_GOING:
                "border-sky-400 bg-gradient-to-br from-sky-200 to-sky-300 dark:from-sky-500/40 dark:to-sky-600/25 dark:border-sky-400/50",
              IDLE:
                "border-amber-400 bg-gradient-to-br from-amber-200 to-amber-300 dark:from-amber-500/40 dark:to-amber-600/25 dark:border-amber-400/50",
            }[bucket];
            const bucketName = {
              ACTIVE: "text-emerald-950 dark:text-emerald-50",
              ON_GOING: "text-sky-950 dark:text-sky-50",
              IDLE: "text-amber-950 dark:text-amber-50",
            }[bucket];
            const bucketSummary = {
              ACTIVE: "text-emerald-900/85 dark:text-emerald-100/85",
              ON_GOING: "text-sky-900/85 dark:text-sky-100/85",
              IDLE: "text-amber-900/85 dark:text-amber-100/85",
            }[bucket];
            const bucketDivider = {
              ACTIVE: "border-emerald-400/70 dark:border-emerald-400/30",
              ON_GOING: "border-sky-400/70 dark:border-sky-400/30",
              IDLE: "border-amber-400/70 dark:border-amber-400/30",
            }[bucket];
            return (
            <li key={c.id} className="animate-fade-up">
              <Link
                href={`/clients/${c.slug}`}
                className={`card-hover group relative block overflow-hidden rounded-2xl border p-5 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent h-full transition-all ${bucketCard}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className={`text-lg font-semibold truncate transition-colors font-display ${bucketName}`}>
                      {c.name}
                    </p>
                    {c.summary ? (
                      <p className={`mt-1 text-sm line-clamp-2 font-description ${bucketSummary}`}>
                        {c.summary}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBucketBadge bucket={bucket} />
                    </div>
                  </div>
                </div>
                <div className={`mt-4 pt-3 border-t flex items-center justify-between gap-2 ${bucketDivider}`}>
                  <ClientLastUpdateLabel
                    iso={last.toISOString()}
                    hasUpdate={c.weeklyUpdates.length > 0 || c.activities.length > 0}
                  />
                  <span className={`text-xs font-medium opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0 transition-all font-description ${bucketName}`}>
                    <T id="clients.open" fallback="Open →" />
                  </span>
                </div>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
