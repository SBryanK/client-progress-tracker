/*
 * build-tracker-xlsx.mjs — produces an up-to-date Bryan Client Tracker
 * workbook from the live Prisma DB.
 *
 * Run via:   npm run build:tracker-xlsx
 *
 * Output:    ./Bryan_Client_Tracker.xlsx (in the project root)
 *
 * The workbook is structured as 6 sheets:
 *
 *   1. Primary           — top, deep-engagement clients
 *   2. Assist            — partner / support clients
 *   3. Akamai            — Akamai → EdgeOne migration cohort
 *   4. Inactive          — paused / dormant
 *   5. Stage Legend      — the 7-stage engagement taxonomy
 *   6. Weekly Summary    — last 4 weeks of weekly updates flattened
 *
 * Design rules:
 *   • The bucket sheets share a fixed header — Customer / Project /
 *     Stage / Progress / Blockers/Challenges / Target Completion /
 *     Target Revenue (USD) / Next Steps / Last Updated.
 *   • For each client, "Project" is the comma-separated tag list (or
 *     industry if no tags), "Stage" is the engagement-stage label,
 *     "Progress" is the most recent weekly update bullets (truncated),
 *     "Blockers/Challenges" is the latest weekly's blockers field,
 *     "Next Steps" is the latest weekly's nextAction field,
 *     "Last Updated" is the most recent weekStart / activity date.
 *   • Anything genuinely unknown is rendered as "TBD" (NOT made-up).
 *   • The script is read-only — never writes to the DB.
 */

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

// SheetJS in ESM mode needs an explicit fs handle for writeFile;
// without this, .writeFile() throws "cannot save file".
XLSX.set_fs(fs);

const prisma = new PrismaClient();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, "..", "Bryan_Client_Tracker.xlsx");

const BUCKETS = ["PRIMARY", "ASSIST", "AKAMAI", "INACTIVE"];
const SHEET_BY_BUCKET = {
  PRIMARY: "Primary",
  ASSIST: "Assist",
  AKAMAI: "Akamai",
  INACTIVE: "Inactive",
};

const STAGE_LABEL = {
  ENGAGEMENT: "1. Engagement",
  PREPARE_POC: "2. Prepare POC",
  POC: "3. POC",
  FINISH_POC: "4. Finish POC",
  PRODUCTION: "5. Production",
  AFTERSALES_PROGRESS: "6. Aftersales Progress",
  DISCONTINUED: "7. Discontinued",
};

const ROW_HEADERS = [
  "Customer",
  "Project",
  "Stage",
  "Progress",
  "Blockers / Challenges",
  "Target Completion",
  "Target Revenue (USD)",
  "Next Steps",
  "Last Updated",
];

function trunc(s, n = 800) {
  if (!s) return "";
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

function fmtDate(d) {
  if (!d) return "TBD";
  return new Date(d).toISOString().slice(0, 10);
}

function pickProject(c) {
  const tags = (c.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.toLowerCase() !== "akamai");
  if (tags.length > 0) return tags.join(", ");
  if (c.industry) return c.industry;
  return "TBD";
}

function buildRow(c) {
  const latestWeekly = c.weeklyUpdates?.[0];
  const latestActivity = c.activities?.[0];

  const lastDates = [
    latestWeekly?.weekStart,
    latestActivity?.occurredOn,
    c.updatedAt,
  ].filter(Boolean);
  const lastUpdated =
    lastDates.length > 0
      ? new Date(Math.max(...lastDates.map((d) => new Date(d).getTime())))
      : null;

  let progress = "TBD";
  if (latestWeekly?.bullets) progress = trunc(latestWeekly.bullets);
  else if (c.summary) progress = trunc(c.summary);

  return [
    c.name,
    pickProject(c),
    STAGE_LABEL[c.stageKey] ?? "1. Engagement",
    progress,
    trunc(latestWeekly?.blockers ?? "TBD"),
    "TBD",
    c.revenueEstimate?.trim() || "TBD",
    trunc(latestWeekly?.nextAction ?? "TBD"),
    fmtDate(lastUpdated),
  ];
}

function buildBucketSheet(rows) {
  const aoa = [ROW_HEADERS, ...rows.map(buildRow)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 28 },
    { wch: 28 },
    { wch: 22 },
    { wch: 60 },
    { wch: 36 },
    { wch: 18 },
    { wch: 22 },
    { wch: 36 },
    { wch: 14 },
  ];
  return ws;
}

function buildStageLegendSheet() {
  const aoa = [
    ["Stage", "Label", "Meaning"],
    ["1", "Engagement", "First contact / discovery / scoping"],
    ["2", "Prepare POC", "Test environment + success criteria agreed"],
    ["3", "POC", "Active proof-of-concept in flight"],
    ["4", "Finish POC", "POC completed, awaiting commercial sign-off"],
    ["5", "Production", "Live in production / SoW signed"],
    ["6", "Aftersales Progress", "Steady-state — ongoing support & expansion"],
    ["7", "Discontinued", "Closed lost / terminated / paused indefinitely"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 8 }, { wch: 22 }, { wch: 60 }];
  return ws;
}

function buildWeeklySummarySheet(weeklies) {
  const aoa = [
    ["Week start", "Client", "Bucket", "Bullets", "Blockers", "Next action"],
    ...weeklies.map((w) => [
      fmtDate(w.weekStart),
      w.client.name,
      SHEET_BY_BUCKET[w.client.status] ?? w.client.status,
      trunc(w.bullets, 600),
      trunc(w.blockers ?? "", 200),
      trunc(w.nextAction ?? "", 200),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 12 },
    { wch: 60 },
    { wch: 36 },
    { wch: 36 },
  ];
  return ws;
}

async function main() {
  console.log("Building Bryan Client Tracker workbook…");

  const clients = await prisma.client.findMany({
    where: { archived: false },
    include: {
      weeklyUpdates: { orderBy: { weekStart: "desc" }, take: 1 },
      activities: { orderBy: { occurredOn: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  function bucketOf(status) {
    const k = (status ?? "").toUpperCase().replace(/[\s-]/g, "_");
    if (["PRIMARY", "ON_WORK", "DEAL"].includes(k)) return "PRIMARY";
    if (
      [
        "ASSIST",
        "ACTIVE",
        "POTENTIAL",
        "PENDING",
        "LEARNING",
        "SHADOWING",
      ].includes(k)
    )
      return "ASSIST";
    if (k === "AKAMAI") return "AKAMAI";
    if (
      ["INACTIVE", "ON_HOLD", "IDLE", "FINISHED", "TERMINATED"].includes(k)
    )
      return "INACTIVE";
    return "PRIMARY";
  }

  const grouped = { PRIMARY: [], ASSIST: [], AKAMAI: [], INACTIVE: [] };
  for (const c of clients) grouped[bucketOf(c.status)].push(c);

  for (const k of BUCKETS)
    grouped[k].sort((a, b) => a.name.localeCompare(b.name));

  const wb = XLSX.utils.book_new();
  for (const k of BUCKETS) {
    const ws = buildBucketSheet(grouped[k]);
    XLSX.utils.book_append_sheet(wb, ws, SHEET_BY_BUCKET[k]);
    console.log(`  ✓ ${SHEET_BY_BUCKET[k]}: ${grouped[k].length} clients`);
  }
  XLSX.utils.book_append_sheet(wb, buildStageLegendSheet(), "Stage Legend");

  const since = new Date();
  since.setDate(since.getDate() - 28);
  const weeklies = await prisma.weeklyUpdate.findMany({
    where: { weekStart: { gte: since } },
    include: { client: true },
    orderBy: { weekStart: "desc" },
  });
  XLSX.utils.book_append_sheet(
    wb,
    buildWeeklySummarySheet(weeklies),
    "Weekly Summary",
  );
  console.log(`  ✓ Weekly Summary: ${weeklies.length} updates (last 28d)`);

  XLSX.writeFile(wb, OUT_PATH);
  console.log(`\nWrote ${OUT_PATH}`);
}

main()
  .catch((err) => {
    console.error("build-tracker-xlsx FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
