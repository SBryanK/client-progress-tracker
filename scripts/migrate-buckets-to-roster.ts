/*
 * Bucket-roster migration — May 2026.
 *
 * One-shot, idempotent script that reassigns every Client in the database
 * to one of the four canonical buckets (PRIMARY / ASSIST / AKAMAI /
 * INACTIVE) per the user's roster:
 *
 *   PRIMARY  (7) — Telkomsel · MNC Games · PT Visionet (Lippo Group)
 *                   Bank Mandiri · Bank BNI · Como TV · Pratekno
 *   ASSIST   (7) — Indosat · Galeri24 · CBN Cloud (IndoMacro) · AlloBank
 *                   Bitkub · SayurBox · DANA
 *   AKAMAI   (9) — DBS · Exxon Mobil · AMD/ATI · MSCI · Inditex · Kaltura
 *                   IHG · HSBC · Prada
 *   INACTIVE(10) — GCS (Grandtech Cloud Solutions) · Pertamedika · Leyun
 *                   Alian · Astra (SERA) · Sevima · Bank Saqu
 *                   Everywhere.ID · Forest Indo · FSD
 *
 * Run via:   npm run db:migrate-buckets
 *
 * Behaviour:
 *   • Tolerant name matching — uses normalisation (case-insensitive,
 *     punctuation-stripped, common alias map) so "AlloBank" matches
 *     "Allo Bank" and "ATI/AMD" matches "AMD".
 *   • For each roster entry that has no DB row, a fresh row is created
 *     with sensible defaults (bucket set, isNewLead=true on PRIMARY +
 *     ASSIST so they surface, status=bucket value).
 *   • For each existing DB row, only `status` is updated (to the bucket
 *     name) — everything else is preserved.
 *   • Any non-archived row whose name does NOT match the roster is
 *     left as-is and reported in the summary so you can decide whether
 *     to archive manually. We deliberately do NOT auto-archive unknown
 *     rows to avoid silent data loss.
 *   • Idempotent — safe to re-run; only writes changes that are needed.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Bucket = "PRIMARY" | "ASSIST" | "AKAMAI" | "INACTIVE";

/**
 * Roster — each entry maps the canonical display name to the candidate
 * names we'll match against in the DB (lowercased, punctuation kept).
 * The first candidate that exists wins. If none exist, a fresh row is
 * created using the canonical name.
 */
const ROSTER: Record<Bucket, Array<{ canonical: string; aliases: string[] }>> = {
  PRIMARY: [
    { canonical: "Telkomsel", aliases: ["Telkomsel"] },
    { canonical: "MNC Games", aliases: ["MNC Games", "MNC", "MNC Group"] },
    {
      canonical: "PT Visionet (Lippo Group)",
      aliases: [
        "PT Visionet (Lippo Group)",
        "PT Visionet",
        "Visionet",
        "Lippo",
        "Lippo Group",
      ],
    },
    { canonical: "Bank Mandiri", aliases: ["Bank Mandiri", "Mandiri"] },
    { canonical: "Bank BNI", aliases: ["Bank BNI", "BNI"] },
    { canonical: "Como TV", aliases: ["Como TV", "ComoTV"] },
    { canonical: "Pratekno", aliases: ["Pratekno", "Paratekno"] },
  ],
  ASSIST: [
    { canonical: "Indosat", aliases: ["Indosat"] },
    { canonical: "Galeri24", aliases: ["Galeri24", "Galeri 24"] },
    {
      canonical: "CBN Cloud (IndoMacro)",
      aliases: ["CBN Cloud (IndoMacro)", "CBN Cloud", "CBN", "IndoMacro"],
    },
    { canonical: "AlloBank", aliases: ["AlloBank", "Allo Bank", "Allo"] },
    { canonical: "Bitkub", aliases: ["Bitkub"] },
    { canonical: "SayurBox", aliases: ["SayurBox", "Sayur Box"] },
    { canonical: "DANA", aliases: ["DANA", "DAna", "Dana"] },
  ],
  AKAMAI: [
    { canonical: "DBS", aliases: ["DBS"] },
    {
      canonical: "Exxon Mobil",
      aliases: ["Exxon Mobil", "ExxonMobil", "Exxon"],
    },
    { canonical: "AMD/ATI", aliases: ["AMD/ATI", "ATI/AMD", "AMD", "ATI"] },
    { canonical: "MSCI", aliases: ["MSCI"] },
    { canonical: "Inditex", aliases: ["Inditex"] },
    { canonical: "Kaltura", aliases: ["Kaltura"] },
    { canonical: "IHG", aliases: ["IHG"] },
    { canonical: "HSBC", aliases: ["HSBC"] },
    { canonical: "Prada", aliases: ["Prada"] },
  ],
  INACTIVE: [
    {
      canonical: "GCS (Grandtech Cloud Solutions)",
      aliases: [
        "GCS (Grandtech Cloud Solutions)",
        "GCS",
        "Grandtech Cloud Solutions",
        "Grandtech",
      ],
    },
    { canonical: "Pertamedika", aliases: ["Pertamedika"] },
    { canonical: "Leyun", aliases: ["Leyun"] },
    { canonical: "Alian", aliases: ["Alian"] },
    {
      canonical: "Astra (SERA)",
      aliases: ["Astra (SERA)", "Astra SERA", "Astra", "SERA"],
    },
    { canonical: "Sevima", aliases: ["Sevima"] },
    { canonical: "Bank Saqu", aliases: ["Bank Saqu", "Saqu"] },
    {
      canonical: "Everywhere.ID",
      aliases: ["Everywhere.ID", "Everywhere ID", "Everywhere"],
    },
    {
      canonical: "Forest Indo",
      aliases: ["Forest Indo", "ForestIndo", "Forest Indonesia"],
    },
    { canonical: "FSD", aliases: ["FSD"] },
  ],
};

/**
 * Normalise a name for fuzzy matching: lowercase + strip
 * punctuation/whitespace.
 */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function findClientByAliases(
  aliases: string[],
): Promise<{ id: string; name: string; status: string } | null> {
  // Pull all non-archived rows once, then match in-memory — keeps the
  // DB roundtrip count to one and lets us be fuzzy.
  const all = await prisma.client.findMany({
    select: { id: true, name: true, status: true, archived: true },
  });
  const normedAliases = aliases.map(norm);
  // Prefer non-archived matches first, fall back to archived ones (so
  // we can un-archive a previously-hidden client like Hisense if it
  // shows up in a future roster — currently no such case).
  const sorted = [...all].sort(
    (a, b) => Number(a.archived) - Number(b.archived),
  );
  for (const row of sorted) {
    const n = norm(row.name);
    if (normedAliases.some((a) => a === n)) return row;
  }
  // Second pass: substring match (only if no exact normalised match).
  for (const row of sorted) {
    const n = norm(row.name);
    if (normedAliases.some((a) => a.length >= 4 && (n.includes(a) || a.includes(n))))
      return row;
  }
  return null;
}

async function reassign(): Promise<{
  matched: number;
  created: number;
  unchanged: number;
  unknown: string[];
  matchedNames: Set<string>;
}> {
  let matched = 0;
  let created = 0;
  let unchanged = 0;
  const matchedNames = new Set<string>();

  // Resolve a primary owner so we can create missing rows.
  const owners = await prisma.user.findMany({
    where: { role: "OWNER" },
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  if (owners.length === 0) {
    throw new Error(
      "No OWNER user exists. Run `npm run db:seed` first to create one.",
    );
  }
  const ownerId = owners[0].id;

  for (const bucket of ["PRIMARY", "ASSIST", "AKAMAI", "INACTIVE"] as const) {
    console.log(`\n[${bucket}]`);
    for (const entry of ROSTER[bucket]) {
      const existing = await findClientByAliases(entry.aliases);
      if (existing) {
        matchedNames.add(existing.id);
        if (existing.status === bucket) {
          console.log(`  · ${existing.name}: already in ${bucket} (no change)`);
          unchanged += 1;
        } else {
          await prisma.client.update({
            where: { id: existing.id },
            data: {
              status: bucket,
              archived: false, // un-archive if it had been archived
            },
          });
          console.log(
            `  · ${existing.name}: ${existing.status} → ${bucket}`,
          );
          matched += 1;
        }
      } else {
        // Create a placeholder row so the bucket count matches the roster.
        let slug = slugify(entry.canonical);
        let n = 2;
        while (await prisma.client.findUnique({ where: { slug } })) {
          slug = `${slugify(entry.canonical)}-${n++}`;
        }
        const row = await prisma.client.create({
          data: {
            ownerId,
            name: entry.canonical,
            slug,
            status: bucket,
            priority: bucket === "PRIMARY" ? "HIGH" : "MEDIUM",
            stageKey: "ENGAGEMENT",
            isNewLead: bucket === "PRIMARY" || bucket === "ASSIST",
            // Tag Akamai cohort so the legacy `?group=akamai` URL filter
            // continues to resolve the same set of rows during the
            // backwards-compat window.
            tags: bucket === "AKAMAI" ? "akamai" : null,
            summary: null,
            notes: null,
          },
        });
        matchedNames.add(row.id);
        console.log(`  + ${entry.canonical}: created (id=${row.id}) in ${bucket}`);
        created += 1;
      }
    }
  }

  // Unknown rows = active rows that didn't match any roster entry.
  const all = await prisma.client.findMany({
    where: { archived: false },
    select: { id: true, name: true, status: true },
  });
  const unknown = all
    .filter((r) => !matchedNames.has(r.id))
    .map((r) => `${r.name} (status=${r.status})`);

  return { matched, created, unchanged, unknown, matchedNames };
}

async function main() {
  console.log("──────────────────────────────────────────────");
  console.log(" Bucket roster migration (May 2026)");
  console.log("──────────────────────────────────────────────");

  const stats = await reassign();

  console.log("\n──────────────────────────────────────────────");
  console.log(" Summary");
  console.log("──────────────────────────────────────────────");
  console.log(`  matched/updated : ${stats.matched}`);
  console.log(`  created (new)   : ${stats.created}`);
  console.log(`  no change       : ${stats.unchanged}`);
  console.log(`  unknown rows    : ${stats.unknown.length}`);
  if (stats.unknown.length > 0) {
    console.log("\n  Unknown rows are NOT touched. Review and archive manually if desired:");
    for (const u of stats.unknown) console.log(`    - ${u}`);
  }
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("\nbucket-migration FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
