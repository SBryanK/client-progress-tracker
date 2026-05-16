/*
 * archive-non-roster.ts — companion to migrate-buckets-to-roster.ts.
 *
 * Archives the small set of clients that don't belong to any of the
 * four canonical buckets (Internal / Industry Engagement / Hisense /
 * Kunlun / Morgan Stanley) and the conflated "ExxonMobil / MSCI" row
 * that the bucket migration replaced with two separate AKAMAI rows.
 *
 * Idempotent: rows already archived are reported and left alone.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TO_ARCHIVE = [
  "ExxonMobil / MSCI",
  "Hisense",
  "Kunlun",
  "Morgan Stanley",
  "Internal",
  "Industry Engagement",
];

async function main() {
  for (const name of TO_ARCHIVE) {
    const c = await prisma.client.findFirst({ where: { name } });
    if (!c) {
      console.log("  · skip (not found):", name);
      continue;
    }
    if (c.archived) {
      console.log("  · already archived:", name);
      continue;
    }
    await prisma.client.update({
      where: { id: c.id },
      data: { archived: true },
    });
    console.log("  + archived:", name);
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
