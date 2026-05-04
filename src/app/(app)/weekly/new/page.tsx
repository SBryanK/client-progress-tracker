import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnerIds } from "@/lib/public";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { NewUpdateForm } from "./new-update-form";

export const dynamic = "force-dynamic";

/**
 * Streamlined "log a weekly update" page.
 *
 * Owner picks a client + week, writes the bullet list, and optionally adds
 * Activity / Contribution / Progress lines.  One click saves everything to
 * the DB so the dashboard, timeline, and client detail refresh instantly.
 */
export default async function NewWeeklyUpdatePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; week?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    redirect("/?signin=1&next=/weekly/new");
  }
  const sp = await searchParams;

  const ownerIds = await getOwnerIds();
  const ownerFilter = ownerIds.length ? { in: ownerIds } : { in: ["__none__"] };

  const clients = await prisma.client.findMany({
    where: { ownerId: ownerFilter, archived: false },
    select: { id: true, name: true, slug: true, status: true },
    orderBy: { name: "asc" },
  });

  // Snap the default week to the most recent Monday (UTC).
  const defaultMonday = (() => {
    const d = new Date();
    const dow = (d.getUTCDay() + 6) % 7; // 0 = Mon
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow));
    return m.toISOString().slice(0, 10);
  })();

  return (
    <div className="flex flex-col gap-8 max-w-3xl animate-fade-up">
      <nav aria-label="Breadcrumb" className="text-sm text-fg-muted">
        <Link
          href="/weekly"
          className="hover:text-fg transition-colors"
        >
          Weekly
        </Link>
        <span className="mx-1.5 text-fg-subtle">/</span>
        <span className="text-fg">New update</span>
      </nav>

      <header>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Log a weekly update
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted max-w-xl">
          Pick a client, pick the week, and jot what happened — everything is
          saved together so the timeline and dashboard refresh instantly.
        </p>
      </header>

      {clients.length === 0 ? (
        <Card>
          <CardTitle as="h2">No clients yet</CardTitle>
          <CardDescription>
            You need at least one client before you can log a weekly update.
          </CardDescription>
          <div className="mt-4">
            <Link
              href="/clients/new"
              className="press inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-fg shadow-md hover:bg-accent-hover hover:shadow-lg transition-all"
            >
              Add your first client
            </Link>
          </div>
        </Card>
      ) : (
        <Card elevated>
          <NewUpdateForm
            clients={clients}
            defaultClientSlug={sp.client ?? clients[0]?.slug ?? ""}
            defaultWeekStart={sp.week ?? defaultMonday}
          />
        </Card>
      )}
    </div>
  );
}
