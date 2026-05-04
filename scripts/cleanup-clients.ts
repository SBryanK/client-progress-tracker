/*
 * One-shot database tidy.
 *
 * Removes the noise that got imported from the Word doc into the Client
 * table (internal notes that aren't real clients) and normalises the
 * name of a couple of clients that accidentally inherited trailing
 * "— NEW LEAD" or "(Ongoing, monitoring) Signed Contract" suffixes.
 *
 * Idempotent — re-running is a no-op.
 *
 *   pnpm tsx scripts/cleanup-clients.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Slugs that are internal notes, event blurbs, or learning logs — NOT real
// clients. They were accidentally created during the Word import.
const DELETE_SLUGS = [
  "internal",
  "internal-activity",
  "internal-learning",
  "attended-as-edgeone-representative-for-product-promotion",
  "openclaw-x-tencent-cloud-jakarta-event",
];

// Duplicate "— NEW LEAD" entries that were imported as separate rows.
// Prefer keeping the canonical record and removing the NEW-LEAD dupe.
const DUPE_NEW_LEAD_SLUGS = [
  "pt-esports-star-indonesia-new-lead",
  "pt-visionet-lippo-group-new-lead",
];

// Client names that need cosmetic tidy.
const RENAMES: Record<string, { name: string; slug: string }> = {
  "galeri24-ongoing-monitoring-signed-contract": {
    name: "Galeri24",
    slug: "galeri24",
  },
  "sayur-box-ongoing-monitoring-signed-contract": {
    name: "Sayur Box",
    slug: "sayur-box",
  },
};

// De-duplicate BNI / Bank BNI, Indosat / IndoSat.
const MERGE_DUPES: Array<{ from: string; into: string }> = [
  { from: "bank-bni", into: "bni" },
  { from: "indosat-2", into: "indosat" },
];

async function main() {
  // 1. Delete internal / event rows outright (and their weekly updates —
  //    cascade is set up in the schema).
  for (const slug of [...DELETE_SLUGS, ...DUPE_NEW_LEAD_SLUGS]) {
    const c = await prisma.client.findUnique({ where: { slug } });
    if (!c) continue;
    await prisma.client.delete({ where: { id: c.id } });
    console.log(`[cleanup] deleted ${slug}`);
  }

  // 2. Rename cosmetic-noise rows.
  for (const [oldSlug, { name, slug }] of Object.entries(RENAMES)) {
    const c = await prisma.client.findUnique({ where: { slug: oldSlug } });
    if (!c) continue;
    // Avoid clobbering an existing good row.
    const collide = await prisma.client.findUnique({ where: { slug } });
    if (collide && collide.id !== c.id) {
      console.log(
        `[cleanup] rename skipped (${oldSlug} → ${slug} already exists)`,
      );
      continue;
    }
    await prisma.client.update({
      where: { id: c.id },
      data: { name, slug },
    });
    console.log(`[cleanup] renamed ${oldSlug} → ${slug}`);
  }

  // 3. Merge duplicate rows by moving their weekly updates + activities
  //    onto the canonical client, then deleting the duplicate.
  for (const { from, into } of MERGE_DUPES) {
    const dupe = await prisma.client.findUnique({ where: { slug: from } });
    const canonical = await prisma.client.findUnique({ where: { slug: into } });
    if (!dupe || !canonical) continue;
    // Only reassign updates whose (clientId, weekStart) wouldn't collide
    // with an existing row on the canonical client — Prisma's @@unique
    // would otherwise reject the update.
    const dupeUpdates = await prisma.weeklyUpdate.findMany({
      where: { clientId: dupe.id },
    });
    for (const u of dupeUpdates) {
      const exists = await prisma.weeklyUpdate.findUnique({
        where: {
          clientId_weekStart: {
            clientId: canonical.id,
            weekStart: u.weekStart,
          },
        },
      });
      if (exists) {
        await prisma.weeklyUpdate.delete({ where: { id: u.id } });
      } else {
        await prisma.weeklyUpdate.update({
          where: { id: u.id },
          data: { clientId: canonical.id },
        });
      }
    }
    await prisma.clientActivity.updateMany({
      where: { clientId: dupe.id },
      data: { clientId: canonical.id },
    });
    await prisma.client.delete({ where: { id: dupe.id } });
    console.log(`[cleanup] merged ${from} → ${into}`);
  }

  // 4. Translate legacy fine-grained statuses onto the new 3-bucket world
  //    so the badges render consistently. (Raw DB values stay, but we
  //    align anything that was clearly "idle" vs. "on-going".)
  //    We don't need to touch anything here — `toStatusBucket()` handles it
  //    at render time — but we do clear the legacy `isNewLead` flag so
  //    no orphan pill can ever surface in the UI.
  await prisma.client.updateMany({
    data: { isNewLead: false },
  });
  console.log("[cleanup] cleared isNewLead on all clients");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
