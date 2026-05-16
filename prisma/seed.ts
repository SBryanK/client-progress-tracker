import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seeds the OWNER account(s) from env vars.
 *
 * Configuration (one of these must be set):
 *   - OWNER_USERNAMES    : comma-separated list of owner usernames (preferred)
 *   - OWNER_USERNAME     : legacy single owner (fallback)
 *
 * Shared password for all owners: OWNER_PASSWORD (default: "ChangeMe!123").
 * Display name: OWNER_NAME (default: "Bryan").
 *
 * All other emails are anonymous public readers — NO viewer accounts are
 * created. The public landing page is readable by anyone.
 */
async function main() {
  const usernamesRaw =
    process.env.OWNER_USERNAMES ?? process.env.OWNER_USERNAME ?? "sbryank";
  const ownerUsernames = usernamesRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (ownerUsernames.length === 0) {
    console.error("[seed] No OWNER_USERNAMES configured. Set OWNER_USERNAMES in .env.");
    process.exit(1);
  }

  const ownerName = process.env.OWNER_NAME ?? "Bryan";
  const ownerPassword = process.env.OWNER_PASSWORD ?? "#1203Sadhu";
  const ownerHash = await bcrypt.hash(ownerPassword, 10);

  for (const username of ownerUsernames) {
    const u = await prisma.user.upsert({
      where: { username },
      update: { name: ownerName, passwordHash: ownerHash, role: "OWNER" },
      create: { 
        username, 
        email: `${username}@local.test`, 
        name: ownerName, 
        role: "OWNER", 
        passwordHash: ownerHash 
      },
    });
    console.log(`[seed] OWNER ready: ${u.username} (password: ${ownerPassword})`);
  }

  // Demote any previously-seeded OWNER accounts that are no longer in the
  // configured list. We do NOT delete them (they may have authored updates) —
  // instead we demote to VIEWER *and* reassign any data they still own to the
  // new primary owner so the tracker keeps showing it.  Public readers never
  // have an account at all.
  const staleOwners = await prisma.user.findMany({
    where: { role: "OWNER", username: { notIn: ownerUsernames } },
    select: { id: true, username: true },
  });

  if (staleOwners.length > 0) {
    // Find the primary-owner id (first configured OWNER username that exists).
    const primary = await prisma.user.findUnique({
      where: { username: ownerUsernames[0] },
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
          `[seed] Reassigned ${reassigned.count} client record(s) from demoted owners → ${ownerUsernames[0]}`,
        );
      }
    }
    await prisma.user.updateMany({
      where: { id: { in: staleOwners.map((u) => u.id) } },
      data: { role: "VIEWER" },
    });
    console.log(
      `[seed] Demoted ${staleOwners.length} previously-owner account(s) to VIEWER: ${staleOwners
        .map((u) => u.username)
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
