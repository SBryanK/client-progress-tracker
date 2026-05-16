// One-shot inspector — DO NOT commit (matches scripts/_*.mjs ignore).
// Usage: node scripts/_inspect-xlsx.mjs <path-to-xlsx>
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/_inspect-xlsx.mjs <path>");
  process.exit(2);
}

const wb = XLSX.read(readFileSync(path), { type: "buffer", cellDates: true });
const out = {};
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  out[name] = rows.slice(0, 80);
}
console.log(JSON.stringify(out, null, 2));
