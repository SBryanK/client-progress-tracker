import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnerIds } from "@/lib/public";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { ClientForm } from "../../client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  const { slug } = await params;
  if (session?.user?.role !== "OWNER") {
    redirect(`/?signin=1&next=${encodeURIComponent(`/clients/${slug}/edit`)}`);
  }
  const ownerIds = await getOwnerIds();
  const client = await prisma.client.findFirst({
    where: { slug, ownerId: ownerIds.length ? { in: ownerIds } : { in: ["__none__"] } },
  });
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Edit client</h1>
        <p className="mt-1 text-sm text-fg-muted">Update {client.name}&apos;s details.</p>
      </header>
      <Card>
        <CardTitle as="h2">Client details</CardTitle>
        <CardDescription>Required fields are marked with an asterisk.</CardDescription>
        <div className="mt-4">
          <ClientForm
            mode="edit"
            initial={{
              id: client.id,
              name: client.name,
              status: client.status,
              priority: client.priority,
              stage: client.stage,
              bdOwner: client.bdOwner,
              region: client.region,
              industry: client.industry,
              accountValue: client.accountValue,
              summary: client.summary,
              notes: client.notes,
              tags: client.tags,
              isNewLead: client.isNewLead,
            }}
          />
        </div>
      </Card>
    </div>
  );
}
