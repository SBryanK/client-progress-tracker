import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOwnerIds } from "@/lib/public";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBucketBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { toStatusBucket } from "@/lib/status";
import { formatWeekRange } from "@/lib/week";
import { WeeklyUpdateForm } from "./weekly-update-form";
import { ActivityForm } from "./activity-form";
import { DeleteClientButton } from "./delete-client-button";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  const { slug } = await params;
  const isOwner = session?.user?.role === "OWNER";
  const ownerIds = await getOwnerIds();

  const client = await prisma.client.findFirst({
    where: {
      slug,
      ownerId: ownerIds.length ? { in: ownerIds } : { in: ["__none__"] },
      archived: false,
    },
    include: {
      weeklyUpdates: { orderBy: { weekStart: "desc" } },
      activities: { orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!client) notFound();

  const works = {
    ACTIVITY: client.activities.filter((a) => a.kind === "ACTIVITY"),
    ISSUE_SUPPORT: client.activities.filter((a) => a.kind === "ISSUE_SUPPORT"),
    PROGRESS: client.activities.filter((a) => a.kind === "PROGRESS"),
  };

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-sm text-fg-muted font-description">
        <Link
          href="/clients"
          className="hover:text-fg transition-colors"
        >
          Clients
        </Link>
        <span className="mx-1.5 text-fg-subtle">/</span>
        <span className="text-fg">{client.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 animate-fade-up">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-fg font-display">
              {client.name}
            </h1>
            <StatusBucketBadge bucket={toStatusBucket(client.status)} />
          </div>
          {client.summary ? (
            <p className="mt-3 text-sm sm:text-base text-fg-muted max-w-3xl leading-relaxed font-description">
              {client.summary}
            </p>
          ) : null}
        </div>
        {isOwner ? (
          <div className="flex items-center gap-2">
            <Link href={`/weekly/new?client=${encodeURIComponent(client.slug)}`}>
              <Button size="sm">
                <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                Log update
              </Button>
            </Link>
            <Link href={`/clients/${client.slug}/edit`}>
              <Button variant="outline" size="sm">
                Edit
              </Button>
            </Link>
            <DeleteClientButton id={client.id} />
          </div>
        ) : null}
      </header>

      {/* summary already rendered inside header */}

      <section className="grid gap-4">
        <Card className="bg-gradient-to-br from-bg to-bg-subtle w-full">
          <div className="flex items-center justify-between gap-2">
            <CardTitle as="h2">Weekly updates</CardTitle>
            {isOwner ? (
              <Link
                href={`/weekly/new?client=${encodeURIComponent(client.slug)}`}
                className="text-sm text-accent hover:underline font-description"
              >
                + Log another →
              </Link>
            ) : null}
          </div>
          <CardDescription className="font-description">Historical progress, newest first.</CardDescription>
          {client.weeklyUpdates.length === 0 ? (
            <p className="mt-4 text-sm text-fg-muted font-description">
              No weekly updates yet.
              {isOwner ? (
                <>
                  {" "}
                  <Link
                    href={`/weekly/new?client=${encodeURIComponent(client.slug)}`}
                    className="text-accent hover:underline"
                  >
                    Log the first one →
                  </Link>
                </>
              ) : null}
            </p>
          ) : (
            <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1 scroll-contain">
              <ul className="space-y-4">
              {client.weeklyUpdates.map((u) => (
                <li key={u.id} className="rounded-lg border border-border/50 bg-bg-subtle/30 p-4 hover:bg-bg-subtle/50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium font-display">
                      {u.weekLabel || formatWeekRange(u.weekStart)}
                    </p>
                    <span className="text-xs text-fg-subtle font-mono">
                      {format(u.weekStart, "yyyy-MM-dd")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm prose-entry whitespace-pre-line font-description">
                    {u.bullets}
                  </p>
                  {u.highlights ? (
                    <p className="mt-2 text-xs text-fg-muted font-description">
                      <span className="font-medium">Highlights:</span> {u.highlights}
                    </p>
                  ) : null}
                  {u.blockers ? (
                    <p className="mt-1 text-xs text-warning font-description">
                      <span className="font-medium">Blockers:</span> {u.blockers}
                    </p>
                  ) : null}
                  {u.nextAction ? (
                    <p className="mt-1 text-xs text-info font-description">
                      <span className="font-medium">Next action:</span> {u.nextAction}
                    </p>
                  ) : null}
                </li>
              ))}
              </ul>
            </div>
          )}
        </Card>

        {isOwner ? (
          <Card>
            <CardTitle as="h2">Quick add</CardTitle>
            <CardDescription>
              For a full composer use{" "}
              <Link
                href={`/weekly/new?client=${encodeURIComponent(client.slug)}`}
                className="text-accent hover:underline"
              >
                the composer
              </Link>
              .
            </CardDescription>
            <div className="mt-3">
              <WeeklyUpdateForm
                clientId={client.id}
                defaultStatus={client.status}
              />
            </div>
          </Card>
        ) : null}
      </section>

      <section aria-label="List of works" className="grid gap-4 lg:grid-cols-3">
        {(
          [
            ["ACTIVITY", "Activities"],
            ["ISSUE_SUPPORT", "Issues / Support"],
            ["PROGRESS", "Progress"],
          ] as const
        ).map(([kind, label]) => (
          <Card key={kind}>
            <CardTitle as="h3">{label}</CardTitle>
            {works[kind].length === 0 ? (
              <p className="mt-3 text-sm text-fg-subtle">—</p>
            ) : (
              <div className="mt-3 max-h-80 overflow-y-auto pr-1 scroll-contain">
                <ul className="space-y-2">
                  {works[kind].map((a) => (
                    <li
                      key={a.id}
                      className="text-sm prose-entry rounded-md px-2 py-1 hover:bg-bg-muted break-words"
                    >
                      {a.occurredOn ? (
                        <span className="text-xs text-fg-subtle mr-1.5 font-mono">
                          {format(a.occurredOn, "d MMM")}
                        </span>
                      ) : null}
                      {a.body}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {isOwner ? (
              <div className="mt-4">
                <ActivityForm clientId={client.id} kind={kind} />
              </div>
            ) : null}
          </Card>
        ))}
      </section>

      {client.notes ? (
        <Card>
          <CardTitle as="h2">Notes</CardTitle>
          <p className="mt-3 text-sm prose-entry whitespace-pre-line">
            {client.notes}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
