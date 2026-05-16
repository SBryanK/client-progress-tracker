import { requireOwner } from "@/lib/roles";
import { getOwnerIds } from "@/lib/public";
import { fetchReport, parseScope } from "@/lib/reports/data";
import { renderDocx } from "@/lib/reports/docx-exporter";
import { renderMarkdown } from "@/lib/reports/markdown-exporter";
import { renderXlsx } from "@/lib/reports/xlsx-exporter";
import { renderPdf } from "@/lib/reports/pdf-exporter";
import { apiError, badRequest } from "@/lib/api";

const MIME: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  md: "text/markdown; charset=utf-8",
};

function safeFilename(scopeStr: string, format: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = scopeStr
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `client-progress_${base}_${stamp}.${format}`;
}

export async function GET(req: Request) {
  try {
    // Reports are owner-only — they aggregate the entire dataset and are
    // intended for management reporting. Anonymous visitors who want a
    // narrower, scoped read-only view should use /share/[token] instead.
    await requireOwner();
    const ownerIds = await getOwnerIds();
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") ?? "docx") as
      | "docx"
      | "pdf"
      | "xlsx"
      | "md";
    if (!MIME[format]) {
      throw badRequest("Unsupported format");
    }
    const scope = parseScope(url.searchParams);
    const data = await fetchReport(ownerIds, scope);
    const filename = safeFilename(scope.kind, format);

    let body: Buffer | string;
    if (format === "docx") body = await renderDocx(data);
    else if (format === "pdf") body = renderPdf(data);
    else if (format === "xlsx") body = renderXlsx(data);
    else body = renderMarkdown(data);

    const headers = new Headers();
    headers.set("content-type", MIME[format]!);
    headers.set("content-disposition", `attachment; filename="${filename}"`);
    headers.set("cache-control", "no-store");

    if (typeof body === "string") {
      return new Response(body, { headers });
    }
    return new Response(new Uint8Array(body), { headers });
  } catch (err) {
    return apiError(err);
  }
}
