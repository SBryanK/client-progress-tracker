// Import parser for .xlsx files. Expects sheets with any of these column headers
// (case-insensitive, flexible order):
//   "Client" / "Name"
//   "Week" / "Week starting" / "Date"
//   "Bullets" / "Update" / "Notes"
//   "Status", "Priority", "Highlights", "Blockers", "Next action"
import * as XLSX from "xlsx";
import { inferStatus, type ClientStatus } from "@/lib/status";
import { parseWeekInput, toWeekStart } from "@/lib/week";
import { slugify } from "@/lib/utils";

export type XlsxParsed = {
  clients: {
    name: string;
    slug: string;
    status: ClientStatus;
    isNewLead: boolean;
  }[];
  weeklyUpdates: {
    clientName: string;
    weekStart: Date;
    weekLabel: string;
    bullets: string;
    highlights?: string;
    blockers?: string;
    nextAction?: string;
    status?: string;
  }[];
};

const COLS: Record<string, string[]> = {
  client: ["client", "name", "customer", "account", "project"],
  week: ["week", "week starting", "week start", "date", "weekstart"],
  bullets: ["bullets", "update", "updates", "notes", "description", "details"],
  highlights: ["highlights", "summary"],
  blockers: ["blockers", "issues"],
  nextAction: ["next action", "next step", "next steps"],
  status: ["status"],
};

function pickCol(headers: string[], kind: keyof typeof COLS): number {
  const lowered = headers.map((h) => (h ?? "").toString().trim().toLowerCase());
  for (const cand of COLS[kind]!) {
    const i = lowered.indexOf(cand);
    if (i >= 0) return i;
  }
  return -1;
}

export function parseXlsx(buffer: Buffer): XlsxParsed {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const clientsByName = new Map<string, XlsxParsed["clients"][number]>();
  const weeklyUpdates: XlsxParsed["weeklyUpdates"] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]!;
    const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });
    if (rows.length === 0) continue;
    const headers = (rows[0] ?? []).map((h) => (h ?? "").toString());
    const ci = {
      client: pickCol(headers, "client"),
      week: pickCol(headers, "week"),
      bullets: pickCol(headers, "bullets"),
      highlights: pickCol(headers, "highlights"),
      blockers: pickCol(headers, "blockers"),
      nextAction: pickCol(headers, "nextAction"),
      status: pickCol(headers, "status"),
    };
    if (ci.client < 0 || ci.bullets < 0) continue;

    for (let r = 1; r < rows.length; r += 1) {
      const row = rows[r] ?? [];
      const name = (row[ci.client] ?? "").toString().trim();
      const bullets = (row[ci.bullets] ?? "").toString().trim();
      if (!name || !bullets) continue;

      let weekStart: Date | null = null;
      let weekLabel = "";
      if (ci.week >= 0) {
        const raw = row[ci.week];
        if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
          weekStart = toWeekStart(raw);
          weekLabel = raw.toISOString().slice(0, 10);
        } else if (typeof raw === "string") {
          const parsed = parseWeekInput(raw);
          if (parsed) {
            weekStart = parsed;
            weekLabel = raw;
          }
        }
      }
      if (!weekStart) continue;

      const statusRaw = ci.status >= 0 ? (row[ci.status] ?? "").toString() : "";

      if (!clientsByName.has(name)) {
        clientsByName.set(name, {
          name,
          slug: slugify(name),
          status: inferStatus(statusRaw || name),
          isNewLead: /new\s*(lead|client)/i.test(statusRaw + " " + name),
        });
      }

      weeklyUpdates.push({
        clientName: name,
        weekStart,
        weekLabel,
        bullets,
        highlights: ci.highlights >= 0 ? (row[ci.highlights] ?? "").toString() : undefined,
        blockers: ci.blockers >= 0 ? (row[ci.blockers] ?? "").toString() : undefined,
        nextAction: ci.nextAction >= 0 ? (row[ci.nextAction] ?? "").toString() : undefined,
        status: ci.status >= 0 ? (row[ci.status] ?? "").toString() : undefined,
      });
    }
  }

  return {
    clients: Array.from(clientsByName.values()),
    weeklyUpdates,
  };
}
