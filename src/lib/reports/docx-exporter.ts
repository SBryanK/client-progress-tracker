// Word (.docx) exporter — produces a professional report that mirrors the
// headings / bullets / client-grouping pattern from Bryan's original template.
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  LevelFormat,
  convertInchesToTwip,
} from "docx";
import type { ReportData } from "./data";
import { STATUS_LABEL, type ClientStatus } from "@/lib/status";

function paragraph(
  text: string,
  opts: {
    heading?: "h1" | "h2" | "h3" | "h4";
    bold?: boolean;
    size?: number;
    spacingAfter?: number;
    align?: "left" | "center" | "right";
  } = {},
) {
  const headingMap: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    h1: HeadingLevel.HEADING_1,
    h2: HeadingLevel.HEADING_2,
    h3: HeadingLevel.HEADING_3,
    h4: HeadingLevel.HEADING_4,
  };
  return new Paragraph({
    heading: opts.heading ? headingMap[opts.heading] : undefined,
    alignment:
      opts.align === "center"
        ? AlignmentType.CENTER
        : opts.align === "right"
          ? AlignmentType.RIGHT
          : AlignmentType.LEFT,
    spacing: { after: opts.spacingAfter ?? 120 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        size: opts.size, // half-points
      }),
    ],
  });
}

function bullet(text: string) {
  return new Paragraph({
    text,
    numbering: { reference: "bryan-bullets", level: 0 },
    spacing: { after: 60 },
  });
}

function splitBullets(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[•·●◦○▪‣∙\-*]\s*/, "").trim())
    .filter(Boolean);
}

export async function renderDocx(data: ReportData): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(paragraph(data.title, { heading: "h1", bold: true, align: "center" }));
  if (data.subtitle) {
    children.push(paragraph(data.subtitle, { heading: "h3", align: "center" }));
  }
  children.push(
    paragraph(`Generated ${new Date().toISOString().slice(0, 10)}`, {
      size: 20,
      align: "center",
      spacingAfter: 240,
    }),
  );

  if (data.rows.length === 0) {
    children.push(paragraph("No data in the selected scope.", { size: 22 }));
  }

  for (const row of data.rows) {
    const statusLabel =
      STATUS_LABEL[(row.client.status as ClientStatus)] ?? row.client.status;
    children.push(
      paragraph(row.client.name, { heading: "h2", bold: true, spacingAfter: 60 }),
    );
    const meta: string[] = [`Status: ${statusLabel}`, `Priority: ${row.client.priority}`];
    if (row.client.stage) meta.push(`Stage: ${row.client.stage}`);
    if (row.client.region) meta.push(`Region: ${row.client.region}`);
    if (row.client.bdOwner) meta.push(`BD: ${row.client.bdOwner}`);
    children.push(paragraph(meta.join("  ·  "), { size: 20, spacingAfter: 120 }));

    if (row.client.summary) {
      children.push(paragraph(row.client.summary, { size: 22, spacingAfter: 120 }));
    }

    for (const u of row.updates) {
      children.push(
        paragraph(u.weekLabel || u.weekStart.toISOString().slice(0, 10), {
          heading: "h3",
          bold: true,
          spacingAfter: 60,
        }),
      );
      for (const line of splitBullets(u.bullets)) {
        children.push(bullet(line));
      }
      if (u.highlights) {
        children.push(paragraph(`Highlights: ${u.highlights}`, { size: 20 }));
      }
      if (u.blockers) {
        children.push(paragraph(`Blockers: ${u.blockers}`, { size: 20 }));
      }
      if (u.nextAction) {
        children.push(paragraph(`Next action: ${u.nextAction}`, { size: 20 }));
      }
    }
    // spacing between clients
    children.push(paragraph("", { spacingAfter: 200 }));
  }

  const doc = new Document({
    creator: "Client Progress Tracker",
    title: data.title,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "bryan-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.2) },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(doc);
}
