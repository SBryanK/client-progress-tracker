import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatWeekRange } from "@/lib/week";
import { STATUS_LABEL } from "@/lib/status";

function safeStatusLabel(s: string | null | undefined): string {
  if (!s) return "";
  return (STATUS_LABEL as Record<string, string>)[s] ?? s;
}

export const dynamic = "force-dynamic";

/**
 * Public, token-scoped, read-only report.
 *
 * Anyone with the link can read; the token is 48 hex chars of CSPRNG output
 * (unguessable). The link fails closed when:
 *   - revoked === true
 *   - expiresAt has passed
 *
 * No auth required — by design. The visible rows are filtered by whatever
 * the owner configured when they created the link (client / date range /
 * status).
 */
export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!link || link.revoked) notFound();
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) notFound();

  const where: Prisma.WeeklyUpdateWhereInput = {
    client: { ownerId: link.userId, archived: false },
  };
  if (link.clientId) {
    where.clientId = link.clientId;
  }
  if (link.fromDate || link.toDate) {
    where.weekStart = {};
    if (link.fromDate)
      (where.weekStart as Prisma.DateTimeFilter).gte = link.fromDate;
    if (link.toDate) (where.weekStart as Prisma.DateTimeFilter).lte = link.toDate;
  }
  if (link.statusFilter) {
    where.OR = [
      { status: link.statusFilter },
      { client: { is: { status: link.statusFilter, ownerId: link.userId } } },
    ];
  }

  const updates = await prisma.weeklyUpdate.findMany({
    where,
    include: { client: true },
    orderBy: { weekStart: "desc" },
    take: 500,
  });

  const scopedClient = link.clientId
    ? await prisma.client.findUnique({ where: { id: link.clientId } })
    : null;

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-10 py-10 flex flex-col gap-6">
      <header className="border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
          Shared read-only report
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{link.label}</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Progress by <strong>{link.user.name}</strong>
          {scopedClient ? ` · client: ${scopedClient.name}` : ""}
          {link.fromDate
            ? ` · from ${format(link.fromDate, "yyyy-MM-dd")}`
            : ""}
          {link.toDate ? ` to ${format(link.toDate, "yyyy-MM-dd")}` : ""}
          {link.statusFilter ? ` · status: ${safeStatusLabel(link.statusFilter)}` : ""}
        </p>
        <p className="mt-1 text-xs text-fg-subtle">
          Read-only. Cannot be edited. Link can be revoked by the owner at any
          time.
        </p>
      </header>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <CardTitle as="h2">Weekly updates</CardTitle>
          <CardDescription>
            {updates.length} {updates.length === 1 ? "entry" : "entries"}
          </CardDescription>
        </div>
        {updates.length === 0 ? (
          <p className="mt-4 text-sm text-fg-muted">
            No weekly updates match this share link&apos;s scope.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {updates.map((u) => (
              <li key={u.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">
                    {u.client.name}
                    <span className="ml-2 text-xs text-fg-subtle">
                      {u.weekLabel || formatWeekRange(u.weekStart)}
                    </span>
                  </p>
                  <StatusBadge status={u.status ?? u.client.status} />
                </div>
                <p className="mt-2 text-sm prose-entry">{u.bullets}</p>
                {u.highlights ? (
                  <p className="mt-2 text-xs text-fg-muted">
                    <span className="font-medium">Highlights:</span>{" "}
                    {u.highlights}
                  </p>
                ) : null}
                {u.blockers ? (
                  <p className="mt-1 text-xs text-warning">
                    <span className="font-medium">Blockers:</span> {u.blockers}
                  </p>
                ) : null}
                {u.nextAction ? (
                  <p className="mt-1 text-xs text-info">
                    <span className="font-medium">Next action:</span>{" "}
                    {u.nextAction}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <footer className="text-xs text-fg-subtle text-center">
        Generated {new Date().toISOString().slice(0, 16).replace("T", " ")} ·{" "}
        <Link href="/" className="text-accent hover:underline">
          client-progress-tracker
        </Link>
      </footer>
    </main>
  );
}
