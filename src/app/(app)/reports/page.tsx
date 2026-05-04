import { prisma } from "@/lib/prisma";
import { getOwnerIds } from "@/lib/public";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { ReportsPanel } from "./reports-panel";
import { CLIENT_STATUSES, STATUS_LABEL } from "@/lib/status";

export const dynamic = "force-dynamic";

/**
 * Reports page is public — anyone can download a snapshot of the weekly
 * client progress. No sign-in gate is applied here; editing is still
 * reserved to the owner.
 */
export default async function ReportsPage() {
  const ownerIds = await getOwnerIds();
  const ownerFilter = ownerIds.length ? { in: ownerIds } : { in: ["__none__"] };
  const clients = await prisma.client.findMany({
    where: { ownerId: ownerFilter, archived: false },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-8 max-w-3xl animate-fade-up">
      <header>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Reports
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted max-w-xl">
          Generate and export client progress reports to Word, PDF, Excel, or
          Markdown. Pick a date range and a format — the rest happens in a
          click. No sign-in required.
        </p>
      </header>

      <Card elevated>
        <CardTitle as="h2">Quick export</CardTitle>
        <CardDescription>Pick a scope and a format.</CardDescription>
        <div className="mt-5">
          <ReportsPanel
            clients={clients}
            statuses={CLIENT_STATUSES.map((s) => ({
              value: s,
              label: STATUS_LABEL[s],
            }))}
          />
        </div>
      </Card>
    </div>
  );
}
