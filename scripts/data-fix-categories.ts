/*
 * One-shot data-fix script for the May 2026 category restructure.
 *
 * Run via:   npm run db:fix-categories
 *
 * What it does (idempotent — safe to run many times):
 *   1. Tags the six canonical Akamai-migration cohort clients with the
 *      `akamai` tag (HSBC, Inditex, ATI/AMD, ExxonMobil, DBS, Prada).
 *      Dedupes the tag if it's already present.
 *   2. Sets the DAna client's status to `ACTIVE` so it sits in the
 *      Participating bucket.
 *   3. Sets the ComoTV client's status to `ON_WORK`.
 *   4. Splits any single conflated `Exxon Mobil / MSCI` row into two
 *      independent client rows. If a row called exactly `MSCI` already
 *      exists, the split is a no-op for that side.
 *   5. Archives the Hisense client (sets `archived = true`) so it
 *      stops showing in the default views, but keeps history intact.
 *
 * Missing names log a "skipped: not found" line and do NOT abort —
 * fresh-DB runs are a valid use case.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const AKAMAI_NAMES = ["HSBC", "Inditex", "ATI/AMD", "ExxonMobil", "DBS", "Prada"] as const;

// Each entry is a list of candidate names; the script tries them in order
// and acts on the first match. Lets us tolerate spelling variants
// ("ATI/AMD" vs "ATI / AMD" vs "AMD").
const AKAMAI_CANDIDATES: Record<string, readonly string[]> = {
  HSBC: ["HSBC"],
  Inditex: ["Inditex"],
  "ATI/AMD": ["ATI/AMD", "ATI / AMD", "AMD", "ATI"],
  ExxonMobil: ["ExxonMobil", "Exxon Mobil", "Exxon"],
  DBS: ["DBS"],
  Prada: ["Prada"],
};

/**
 * Append `tag` to a comma-separated `tags` column without producing
 * duplicates. Trims whitespace around each existing tag.
 */
function appendTag(existing: string | null | undefined, tag: string): string {
  const t = tag.toLowerCase().trim();
  const set = new Set<string>();
  if (existing) {
    for (const part of existing.split(",")) {
      const v = part.trim().toLowerCase();
      if (v) set.add(v);
    }
  }
  set.add(t);
  return [...set].join(",");
}

async function findClientByCandidate(
  names: readonly string[],
): Promise<{ id: string; name: string; tags: string | null } | null> {
  for (const n of names) {
    const c = await prisma.client.findFirst({
      where: { name: n },
      select: { id: true, name: true, tags: true },
    });
    if (c) return c;
  }
  return null;
}

async function tagAkamaiCohort() {
  console.log("[1/5] Tagging Akamai migration cohort…");
  for (const canonical of AKAMAI_NAMES) {
    const candidates = AKAMAI_CANDIDATES[canonical];
    const found = await findClientByCandidate(candidates);
    if (!found) {
      console.log(`     skipped: not found — tried ${candidates.join(" / ")}`);
      continue;
    }
    const next = appendTag(found.tags, "akamai");
    if (next === found.tags) {
      console.log(`     ${found.name}: already tagged (no change)`);
      continue;
    }
    await prisma.client.update({
      where: { id: found.id },
      data: { tags: next },
    });
    console.log(`     ${found.name}: tags = "${next}"`);
  }
}

async function fixSingleStatus(name: string, target: string, label: string) {
  const c = await prisma.client.findFirst({
    where: { name: { contains: name } },
    select: { id: true, name: true, status: true },
  });
  if (!c) {
    console.log(`     skipped: not found — ${name}`);
    return;
  }
  if (c.status === target) {
    console.log(`     ${c.name}: already ${target} (no change)`);
    return;
  }
  await prisma.client.update({
    where: { id: c.id },
    data: { status: target },
  });
  console.log(`     ${c.name}: status ${c.status} → ${target} (${label})`);
}

async function splitExxonMsci() {
  console.log("[4/5] Splitting any conflated Exxon Mobil / MSCI row…");
  // Look for rows whose name contains both tokens.
  const candidates = await prisma.client.findMany({
    where: {
      OR: [
        { name: { contains: "MSCI" } },
        { name: { contains: "Exxon" } },
      ],
    },
  });
  const conflated = candidates.find((c) => {
    const n = c.name.toLowerCase();
    return n.includes("msci") && n.includes("exxon");
  });
  if (!conflated) {
    console.log("     skipped: no conflated row found");
    return;
  }
  // Make sure standalone rows exist for both sides.
  for (const target of ["ExxonMobil", "MSCI"] as const) {
    const exists = await prisma.client.findFirst({
      where: { name: target },
      select: { id: true },
    });
    if (exists) {
      console.log(`     ${target}: already exists (skipped create)`);
      continue;
    }
    // Slugify locally (mirrors src/lib/utils.ts); we only need ASCII.
    const slug = target
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const created = await prisma.client.create({
      data: {
        ownerId: conflated.ownerId,
        name: target,
        slug,
        status: conflated.status,
        priority: conflated.priority,
        stage: conflated.stage,
        stageKey: conflated.stageKey,
        tags: conflated.tags,
        notes: conflated.notes
          ? `(Split from "${conflated.name}" on ${new Date().toISOString().slice(0, 10)})\n\n${conflated.notes}`
          : null,
        summary: conflated.summary,
        bdOwner: conflated.bdOwner,
        region: conflated.region,
        industry: conflated.industry,
        accountValue: conflated.accountValue,
        revenueEstimate: conflated.revenueEstimate,
        firstEngagementOn: conflated.firstEngagementOn,
        signedOn: conflated.signedOn,
        archived: false,
      },
    });
    console.log(`     ${target}: created (id=${created.id})`);
  }
  // Archive the original conflated row so it stops surfacing.
  await prisma.client.update({
    where: { id: conflated.id },
    data: { archived: true },
  });
  console.log(`     archived original "${conflated.name}" (id=${conflated.id})`);
}

async function archiveHisense() {
  console.log("[5/5] Archiving Hisense (if present)…");
  const c = await prisma.client.findFirst({
    where: { name: { contains: "Hisense" } },
    select: { id: true, name: true, archived: true },
  });
  if (!c) {
    console.log("     skipped: not found — Hisense");
    return;
  }
  if (c.archived) {
    console.log(`     ${c.name}: already archived (no change)`);
    return;
  }
  await prisma.client.update({
    where: { id: c.id },
    data: { archived: true },
  });
  console.log(`     ${c.name}: archived`);
}

async function main() {
  console.log("──────────────────────────────────────────────");
  console.log(" Data-fix: category restructure (May 2026)");
  console.log("──────────────────────────────────────────────");
  await tagAkamaiCohort();
  console.log("[2/5] DAna → Participating (status=ACTIVE)…");
  await fixSingleStatus("DAna", "ACTIVE", "Participating");
  console.log("[3/5] ComoTV → On-work (status=ON_WORK)…");
  await fixSingleStatus("ComoTV", "ON_WORK", "On-work");
  await splitExxonMsci();
  await archiveHisense();
  console.log("──────────────────────────────────────────────");
  console.log(" Done.");
  console.log("──────────────────────────────────────────────");
}

main()
  .catch((err) => {
    console.error("data-fix-categories failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
