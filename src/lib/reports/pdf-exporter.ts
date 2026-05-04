// PDF exporter using jsPDF + jspdf-autotable. Produces a clean paginated
// document with a header, a summary table per client, and bullet lists.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportData } from "./data";
import { STATUS_LABEL, type ClientStatus } from "@/lib/status";

function splitBullets(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[•·●◦○▪‣∙\-*]\s*/, "").trim())
    .filter(Boolean);
}

export function renderPdf(data: ReportData): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(data.title, pageWidth / 2, y, { align: "center" });
  y += 22;
  if (data.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(data.subtitle, pageWidth / 2, y, { align: "center" });
    y += 16;
  }
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Generated ${new Date().toISOString().slice(0, 10)}`,
    pageWidth / 2,
    y,
    { align: "center" },
  );
  y += 20;
  doc.setTextColor(0);

  // Summary table
  const summaryBody = data.rows.map((r) => [
    r.client.name,
    STATUS_LABEL[(r.client.status as ClientStatus)] ?? r.client.status,
    r.client.priority,
    r.updates[0]?.weekStart.toISOString().slice(0, 10) ?? "—",
    String(r.updates.length),
  ]);
  if (summaryBody.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Client", "Status", "Priority", "Latest week", "Updates"]],
      body: summaryBody,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      margin: { left: margin, right: margin },
    });
    y =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? y;
    y += 20;
  }

  // Per-client details
  for (const row of data.rows) {
    if (y > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(row.client.name, margin, y);
    y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    const meta: string[] = [
      `Status: ${STATUS_LABEL[(row.client.status as ClientStatus)] ?? row.client.status}`,
      `Priority: ${row.client.priority}`,
    ];
    if (row.client.stage) meta.push(`Stage: ${row.client.stage}`);
    if (row.client.region) meta.push(`Region: ${row.client.region}`);
    if (row.client.bdOwner) meta.push(`BD: ${row.client.bdOwner}`);
    doc.text(meta.join("  •  "), margin, y);
    y += 14;
    doc.setTextColor(0);

    for (const u of row.updates) {
      if (y > doc.internal.pageSize.getHeight() - 80) {
        doc.addPage();
        y = margin;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(u.weekLabel || u.weekStart.toISOString().slice(0, 10), margin, y);
      y += 14;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const b of splitBullets(u.bullets)) {
        const wrapped = doc.splitTextToSize(`• ${b}`, maxWidth - 12) as string[];
        if (y + wrapped.length * 12 > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(wrapped, margin + 12, y);
        y += wrapped.length * 12 + 2;
      }
      if (u.highlights) y = writeMeta(doc, "Highlights", u.highlights, margin, y, maxWidth);
      if (u.blockers) y = writeMeta(doc, "Blockers", u.blockers, margin, y, maxWidth);
      if (u.nextAction) y = writeMeta(doc, "Next action", u.nextAction, margin, y, maxWidth);
      y += 8;
    }
    y += 10;
  }

  const ab = doc.output("arraybuffer") as ArrayBuffer;
  return Buffer.from(ab);
}

function writeMeta(
  doc: jsPDF,
  label: string,
  value: string,
  margin: number,
  y: number,
  maxWidth: number,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const text = `${label}: ${value}`;
  const wrapped = doc.splitTextToSize(text, maxWidth - 12) as string[];
  if (y + wrapped.length * 12 > doc.internal.pageSize.getHeight() - margin) {
    doc.addPage();
    y = margin;
  }
  doc.text(wrapped, margin + 12, y);
  doc.setFont("helvetica", "normal");
  return y + wrapped.length * 12 + 2;
}
