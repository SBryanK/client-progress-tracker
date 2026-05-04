import { readFile } from "node:fs/promises";
import { parseDocx } from "../src/lib/import-docx";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: tsx scripts/verify-docx.ts <file.docx>");
    process.exit(2);
  }
  const buf = await readFile(filePath);
  const parsed = await parseDocx(buf);
  console.log(`clients=${parsed.clients.length}`);
  console.log(`weeklyUpdates=${parsed.weeklyUpdates.length}`);
  console.log(`activities=${parsed.activities.length}`);
  console.log("\nFirst 30 clients:");
  for (const c of parsed.clients.slice(0, 30)) {
    console.log(` - ${c.name}   [${c.status}${c.isNewLead ? ", new-lead" : ""}]`);
  }
  console.log("\nWeekly updates by week:");
  const byWeek = new Map<string, number>();
  for (const u of parsed.weeklyUpdates) {
    const k = `${u.weekLabel} (${u.weekStart.toISOString().slice(0, 10)})`;
    byWeek.set(k, (byWeek.get(k) ?? 0) + 1);
  }
  for (const [k, n] of byWeek) console.log(` - ${k}: ${n} clients`);
  console.log("\nActivity kinds:");
  const byKind: Record<string, number> = { ACTIVITY: 0, ISSUE_SUPPORT: 0, PROGRESS: 0 };
  for (const a of parsed.activities) byKind[a.kind] = (byKind[a.kind] ?? 0) + 1;
  console.log(byKind);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
