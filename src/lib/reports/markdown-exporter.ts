import type { ReportData } from "./data";
import { STATUS_LABEL, type ClientStatus } from "@/lib/status";

function splitBullets(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[•·●◦○▪‣∙\-*]\s*/, "").trim())
    .filter(Boolean);
}

export function renderMarkdown(data: ReportData): string {
  const lines: string[] = [];
  lines.push(`# ${data.title}`);
  if (data.subtitle) lines.push(`### ${data.subtitle}`);
  lines.push("");
  lines.push(`_Generated ${new Date().toISOString().slice(0, 10)}_`);
  lines.push("");

  if (data.rows.length === 0) {
    lines.push("_No data in the selected scope._");
    return lines.join("\n");
  }

  for (const row of data.rows) {
    const statusLabel =
      STATUS_LABEL[(row.client.status as ClientStatus)] ?? row.client.status;
    lines.push(`## ${row.client.name}`);
    const meta: string[] = [`**Status:** ${statusLabel}`, `**Priority:** ${row.client.priority}`];
    if (row.client.stage) meta.push(`**Stage:** ${row.client.stage}`);
    if (row.client.region) meta.push(`**Region:** ${row.client.region}`);
    if (row.client.bdOwner) meta.push(`**BD:** ${row.client.bdOwner}`);
    lines.push(meta.join(" · "));
    if (row.client.summary) {
      lines.push("");
      lines.push(`> ${row.client.summary}`);
    }
    lines.push("");

    for (const u of row.updates) {
      lines.push(`### ${u.weekLabel || u.weekStart.toISOString().slice(0, 10)}`);
      for (const b of splitBullets(u.bullets)) {
        lines.push(`- ${b}`);
      }
      if (u.highlights) lines.push(`- **Highlights:** ${u.highlights}`);
      if (u.blockers) lines.push(`- **Blockers:** ${u.blockers}`);
      if (u.nextAction) lines.push(`- **Next action:** ${u.nextAction}`);
      lines.push("");
    }
    lines.push("");
  }

  return lines.join("\n");
}
