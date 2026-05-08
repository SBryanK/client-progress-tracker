import Link from "next/link";
import { format, startOfWeek } from "date-fns";
import { Plus, Calendar } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnerIds } from "@/lib/public";
import { Card } from "@/components/ui/card";
import { StatusBucketBadge } from "@/components/status-badge";
import { toStatusBucket } from "@/lib/status";
import { formatWeekRange } from "@/lib/week";

export const dynamic = "force-dynamic";

/**
 * Public weekly timeline.
 *
 * Vertical rail (gradient line + dot) grouping every weekly update by its
 * Monday-start week. Signed-in owners see a primary "Log update" CTA.
 * The dot for the *current* week pulses to anchor the eye.
 */
export default async function WeeklyPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const session = await auth();
  const isOwner = session?.user?.role === "OWNER";
  const ownerIds = await getOwnerIds();
  const ownerFilter = ownerIds.length ? { in: ownerIds } : { in: ["__none__"] };
  const sp = await searchParams;

  const updates = await prisma.weeklyUpdate.findMany({
    where: {
      client: sp.client
        ? { slug: sp.client, ownerId: ownerFilter, archived: false }
        : { ownerId: ownerFilter, archived: false },
    },
    include: { client: true },
    orderBy: { weekStart: "desc" },
    take: 200,
  });

  const groups = new Map<string, typeof updates>();
  for (const u of updates) {
    const key = format(u.weekStart, "yyyy-MM-dd");
    const arr = groups.get(key) ?? [];
    arr.push(u);
    groups.set(key, arr);
  }
  const weekKeys = Array.from(groups.keys());
  const thisMondayKey = format(
    startOfWeek(new Date(), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );

  return (
    <div className="flex flex-col gap-8">
      {/* ═══ Header ════════════════════════════════════════════════════════ */}
      <header className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight font-display">
            Weekly progress
          </h1>
          {sp.client ? (
            <p className="mt-1.5 text-sm text-fg-muted font-description">
              Filtered to{" "}
              <span className="font-medium text-fg">{sp.client}</span>{" "}
              ·{" "}
              <Link href="/weekly" className="text-accent hover:underline">
                clear
              </Link>
            </p>
          ) : null}
        </div>
        {isOwner ? (
          <Link
            href={`/weekly/new${sp.client ? `?client=${encodeURIComponent(sp.client)}` : ""}`}
            className="press inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-fg shadow-md hover:bg-accent-hover hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Log update
          </Link>
        ) : null}
      </header>

      {/* ═══ Timeline ═══════════════════════════════════════════════════ */}
      {weekKeys.length === 0 ? (
        <Card className="bg-gradient-to-br from-bg to-bg-subtle">
          <div className="flex flex-col items-center gap-3 text-center py-8">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-bg-muted text-fg-subtle">
              <Calendar className="h-6 w-6" aria-hidden />
            </div>
            <p className="text-sm text-fg-muted font-description">
              No weekly updates yet.
              {isOwner ? (
                <>
                  {" "}
                  <Link
                    href="/weekly/new"
                    className="text-accent hover:underline font-medium"
                  >
                    Log the first one →
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </Card>
      ) : (
        <ol
          aria-label="Weekly updates, newest first"
          className="relative pl-14 sm:pl-20 stagger"
        >
          {weekKeys.map((weekKey, idx) => {
            const items = groups.get(weekKey)!;
            const weekStart = items[0]!.weekStart;
            const label = items[0]!.weekLabel || formatWeekRange(weekStart);
            const isThisWeek = weekKey === thisMondayKey;
            // The "live" dot pulses on the newest week in the list (index 0)
            // regardless of whether it matches the real current ISO week.
            const isLatest = idx === 0;
            const isLast = idx === weekKeys.length - 1;
            return (
              <li
                key={weekKey}
                className="relative pb-12 last:pb-0 animate-fade-up"
                aria-labelledby={`wk-${weekKey}`}
              >
                {/* Vertical connector segment — starts below the dot so it
                    never passes through the label/dot circle. */}
                {!isLast ? (
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute left-6 sm:left-8 top-12 bottom-0 w-0.5 -translate-x-1/2 ${
                      isLatest
                        ? "bg-gradient-to-b from-accent/80 to-border-strong"
                        : "bg-border-strong/60"
                    }`}
                  />
                ) : null}
                {/* Rail dot — sits in its own gutter, vertically aligned with
                    the first line of the week heading. */}
                <span
                  aria-hidden
                  className={`absolute left-6 sm:left-8 top-[14px] sm:top-[18px] z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full ring-4 ring-bg shadow-sm ${
                    isLatest
                      ? "bg-accent animate-pulse-ring"
                      : "bg-border-strong"
                  }`}
                />
                {/* Week header */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <h2
                    id={`wk-${weekKey}`}
                    className="text-xl sm:text-2xl font-semibold tracking-tight font-display"
                  >
                    {label}
                  </h2>
                  {isLatest ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent uppercase tracking-wider font-description">
                      <span aria-hidden className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                      </span>
                      {isThisWeek ? "Live · this week" : "Latest"}
                    </span>
                  ) : null}
                  <span className="text-xs text-fg-subtle font-mono">
                    {format(weekStart, "yyyy-MM-dd")}
                  </span>
                  <span className="text-xs text-fg-subtle font-description">
                    · {items.length} client{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                {/* Entry cards */}
                <ul className="grid gap-4 md:grid-cols-2">
                  {items.map((u) => (
                    <li
                      key={u.id}
                      className="card-hover rounded-2xl border border-border/50 bg-gradient-to-br from-bg to-bg-subtle p-5 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/clients/${u.client.slug}`}
                          className="font-semibold truncate hover:underline font-display"
                        >
                          {u.client.name}
                        </Link>
                        <StatusBucketBadge
                          bucket={toStatusBucket(u.status ?? u.client.status)}
                        />
                      </div>
                      <p className="mt-2.5 text-sm prose-entry text-fg-muted font-description">
                        {u.bullets}
                      </p>
                      {u.highlights ? (
                        <p className="mt-3 text-xs text-fg-muted border-l-2 border-accent pl-2 font-description">
                          <span className="font-medium text-fg">Highlights:</span> {u.highlights}
                        </p>
                      ) : null}
                      {u.blockers ? (
                        <p className="mt-1.5 text-xs text-warning font-description">
                          <span className="font-medium">Blockers:</span> {u.blockers}
                        </p>
                      ) : null}
                      {u.nextAction ? (
                        <p className="mt-1 text-xs text-info font-description">
                          <span className="font-medium">Next:</span> {u.nextAction}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
