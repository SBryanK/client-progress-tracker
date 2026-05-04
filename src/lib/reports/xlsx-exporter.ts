import * as XLSX from "xlsx";
import type { ReportData } from "./data";
import { STATUS_LABEL, type ClientStatus } from "@/lib/status";

type SheetRow = {
  Client: string;
  Status: string;
  Priority: string;
  Stage: string;
  Region: string;
  BD: string;
  "Week label": string;
  "Week starting": string;
  Bullets: string;
  Highlights: string;
  Blockers: string;
  "Next action": string;
};

export function renderXlsx(data: ReportData): Buffer {
  const rows: SheetRow[] = [];
  for (const row of data.rows) {
    const statusLabel =
      STATUS_LABEL[(row.client.status as ClientStatus)] ?? row.client.status;
    if (row.updates.length === 0) {
      rows.push({
        Client: row.client.name,
        Status: statusLabel,
        Priority: row.client.priority,
        Stage: row.client.stage ?? "",
        Region: row.client.region ?? "",
        BD: row.client.bdOwner ?? "",
        "Week label": "",
        "Week starting": "",
        Bullets: row.client.summary ?? "",
        Highlights: "",
        Blockers: "",
        "Next action": "",
      });
      continue;
    }
    for (const u of row.updates) {
      rows.push({
        Client: row.client.name,
        Status: statusLabel,
        Priority: row.client.priority,
        Stage: row.client.stage ?? "",
        Region: row.client.region ?? "",
        BD: row.client.bdOwner ?? "",
        "Week label": u.weekLabel,
        "Week starting": u.weekStart.toISOString().slice(0, 10),
        Bullets: u.bullets,
        Highlights: u.highlights ?? "",
        Blockers: u.blockers ?? "",
        "Next action": u.nextAction ?? "",
      });
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 28 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 18 },
    { wch: 22 },
    { wch: 14 },
    { wch: 60 },
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");

  // Summary sheet
  const summaryRows = data.rows.map((r) => ({
    Client: r.client.name,
    Status:
      STATUS_LABEL[(r.client.status as ClientStatus)] ?? r.client.status,
    Priority: r.client.priority,
    "Latest week":
      r.updates[0]?.weekStart.toISOString().slice(0, 10) ?? "",
    "Latest highlights": r.updates[0]?.highlights ?? "",
    "Update count": r.updates.length,
  }));
  const ws2 = XLSX.utils.json_to_sheet(summaryRows);
  ws2["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 50 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Summary");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
  return buf;
}
