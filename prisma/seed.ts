import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seeds the OWNER account(s) from env vars.
 *
 * Configuration (one of these must be set):
 *   - OWNER_EMAILS      : comma-separated list of owner emails (preferred)
 *   - OWNER_EMAIL       : legacy single owner (fallback)
 *
 * Shared password for all owners: OWNER_PASSWORD (default: "ChangeMe!123").
 * Display name: OWNER_NAME (default: "Bryan").
 *
 * All other emails are anonymous public readers — NO viewer accounts are
 * created. The public landing page is readable by anyone.
 */
async function main() {
  const emailsRaw =
    process.env.OWNER_EMAILS ?? process.env.OWNER_EMAIL ?? "bryan@local.test";
  const ownerEmails = emailsRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (ownerEmails.length === 0) {
    console.error("[seed] No OWNER_EMAILS configured. Set OWNER_EMAILS in .env.");
    process.exit(1);
  }

  const ownerName = process.env.OWNER_NAME ?? "Bryan";
  const ownerPassword = process.env.OWNER_PASSWORD ?? "ChangeMe!123";
  const ownerHash = await bcrypt.hash(ownerPassword, 10);

  for (const email of ownerEmails) {
    const u = await prisma.user.upsert({
      where: { email },
      update: { name: ownerName, passwordHash: ownerHash, role: "OWNER" },
      create: { email, name: ownerName, role: "OWNER", passwordHash: ownerHash },
    });
    console.log(`[seed] OWNER ready: ${u.email}  (password: ${ownerPassword})`);
  }

  // Demote any previously-seeded OWNER accounts that are no longer in the
  // configured list. We do NOT delete them (they may have authored updates) —
  // instead we demote to VIEWER *and* reassign any data they still own to the
  // new primary owner so the tracker keeps showing it.  Public readers never
  // have an account at all.
  const staleOwners = await prisma.user.findMany({
    where: { role: "OWNER", email: { notIn: ownerEmails } },
    select: { id: true, email: true },
  });

  if (staleOwners.length > 0) {
    // Find the primary-owner id (first configured OWNER email that exists).
    const primary = await prisma.user.findUnique({
      where: { email: ownerEmails[0] },
      select: { id: true },
    });
    if (primary) {
      const staleIds = staleOwners.map((u) => u.id);
      const reassigned = await prisma.client.updateMany({
        where: { ownerId: { in: staleIds } },
        data: { ownerId: primary.id },
      });
      if (reassigned.count > 0) {
        console.log(
          `[seed] Reassigned ${reassigned.count} client record(s) from demoted owners → ${ownerEmails[0]}`,
        );
      }
    }
    await prisma.user.updateMany({
      where: { id: { in: staleOwners.map((u) => u.id) } },
      data: { role: "VIEWER" },
    });
    console.log(
      `[seed] Demoted ${staleOwners.length} previously-owner account(s) to VIEWER: ${staleOwners
        .map((u) => u.email)
        .join(", ")}`,
    );
  }
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
