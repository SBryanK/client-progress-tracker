import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * One-shot admin utility: reassigns every Client (and its cascaded
 * WeeklyUpdate / ClientActivity) from a previous owner to the current
 * primary OWNER_EMAILS[0].
 *
 * Safe to run multiple times — it only acts on rows whose ownerId is NOT
 * already one of the configured OWNER_EMAILS.
 *
 * Usage:
 *   npx tsx scripts/reassign-owner.ts
 */
async function main() {
  const prisma = new PrismaClient();

  const emailsRaw = process.env.OWNER_EMAILS ?? process.env.OWNER_EMAIL ?? "";
  const ownerEmails = emailsRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (ownerEmails.length === 0) {
    console.error("[reassign] OWNER_EMAILS is empty. Set it in .env first.");
    process.exit(1);
  }

  const primary = ownerEmails[0]!;
  const primaryUser = await prisma.user.findUnique({ where: { email: primary } });
  if (!primaryUser) {
    console.error(
      `[reassign] No user for ${primary}. Run "npm run db:seed" first.`,
    );
    process.exit(1);
  }
  const owners = await prisma.user.findMany({
    where: { email: { in: ownerEmails } },
    select: { id: true },
  });
  const ownerIds = owners.map((o) => o.id);

  const before = await prisma.client.count({
    where: { ownerId: { notIn: ownerIds } },
  });
  if (before === 0) {
    console.log("[reassign] Nothing to do — every client already belongs to an owner.");
    await prisma.$disconnect();
    return;
  }

  const r = await prisma.client.updateMany({
    where: { ownerId: { notIn: ownerIds } },
    data: { ownerId: primaryUser.id },
  });
  console.log(
    `[reassign] Reassigned ${r.count} client(s) to ${primary} (id=${primaryUser.id}).`,
  );

  // Clients own their weekly updates + activities via cascaded relations,
  // but those rows also reference `authorId` (the human who wrote them).
  // Keep authorId intact — we are only changing ownership of the Client.

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[reassign] failed:", err);
  process.exit(1);
});
