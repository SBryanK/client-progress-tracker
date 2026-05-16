import * as XLSX from "xlsx";
const wb = XLSX.readFile("Bryan_Client_Tracker.xlsx");
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`\n=== ${name} (${rows.length} rows) ===`);
  for (const r of rows.slice(0, 6)) {
    console.log("  ", r.slice(0, 4).map(c => String(c ?? "").slice(0, 30)).join(" | "));
  }
}
