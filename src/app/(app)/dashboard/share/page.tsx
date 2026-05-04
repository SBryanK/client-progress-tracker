import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/roles";
import { ShareManager } from "./share-manager";

export const dynamic = "force-dynamic";

/**
 * Owner-only share-link manager. Private because the layout route is
 * `/dashboard/share`, which is under the private `/dashboard` prefix.
 */
export default async function DashboardSharePage() {
  const session = await requireOwner();
  const clients = await prisma.client.findMany({
    where: { ownerId: session.user.id, archived: false },
    orderBy: { name: "asc" },
    select: { slug: true, name: true },
  });
  const clientOptions = clients.map((c) => ({ value: c.slug, label: c.name }));
  return <ShareManager clients={clientOptions} />;
}
