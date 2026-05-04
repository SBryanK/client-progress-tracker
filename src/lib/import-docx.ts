// Parse Bryan's Word tracker into structured data.
//
// The document has two halves:
//   A) "Weekly Updates" — each week has a date-range header ("April 6 – April 10"),
//      then client-name sub-headings followed by bullet lines starting with "•" or "-".
//   B) "List of Works" — each client heading is followed by "Activities",
//      "Issues/Support", and "Progress" sub-sections with bullet-like lines.
//
// We use `mammoth` to get a flat list of paragraphs with inferred heading styles,
// then apply the rules above heuristically.

import mammoth from "mammoth";
import { inferStatus, type ClientStatus } from "@/lib/status";
import { parseWeekInput, toWeekStart } from "@/lib/week";
import { slugify } from "@/lib/utils";

export type ParsedClient = {
  name: string;
  slug: string;
  status: ClientStatus;
  summary?: string;
  isNewLead: boolean;
};

export type ParsedWeeklyUpdate = {
  clientName: string;
  weekStart: Date;
  weekLabel: string;
  bullets: string[];
};

export type ParsedActivity = {
  clientName: string;
  kind: "ACTIVITY" | "ISSUE_SUPPORT" | "PROGRESS";
  body: string;
};

export type ParsedTracker = {
  clients: ParsedClient[];
  weeklyUpdates: ParsedWeeklyUpdate[];
  activities: ParsedActivity[];
  notes: string[]; // parser diagnostics
};

// Matches "April 6 – April 10", "April 6 - 10", "April 27 – May 2", "Apr 27 – May 2 2025".
const WEEK_RE =
  /^\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})\s*[–-]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(\d{1,2})(?:\s*,?\s*(\d{4}))?\s*$/i;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

function monthIndex(s: string): number {
  const k = s.toLowerCase().replace(".", "").slice(0, 4);
  return MONTHS[k as keyof typeof MONTHS] ?? MONTHS[k.slice(0, 3) as keyof typeof MONTHS] ?? -1;
}

function weekLabelToDate(label: string, fallbackYear: number): Date | null {
  const m = WEEK_RE.exec(label);
  if (!m) return null;
  const mon1 = monthIndex(m[1]!);
  const day1 = Number(m[2]);
  const year = Number(m[5] ?? fallbackYear);
  if (mon1 < 0 || Number.isNaN(day1) || Number.isNaN(year)) return null;
  const start = new Date(Date.UTC(year, mon1, day1));
  return toWeekStart(start);
}

const BULLET_PREFIX_RE = /^\s*[•·●◦○▪‣∙\-*]\s+/;

function stripBullet(line: string): string {
  return line.replace(BULLET_PREFIX_RE, "").trim();
}

function looksLikeBullet(line: string): boolean {
  return BULLET_PREFIX_RE.test(line);
}

function isHeadingLine(paragraph: MammothParagraph): boolean {
  const html = paragraph.html ?? "";
  return /^<h[1-6]/i.test(html.trim());
}

type MammothParagraph = { text: string; html?: string };

function getParagraphs(html: string): MammothParagraph[] {
  // mammoth returns full HTML; split into <h*>/<p>/<li> blocks
  const out: MammothParagraph[] = [];
  const re = /<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1]!.toLowerCase();
    const inner = (m[2] ?? "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const text = inner.trim();
    if (!text) continue;
    const wrappedHtml = /^h[1-6]$/.test(tag) ? `<${tag}>${text}</${tag}>` : `<p>${text}</p>`;
    out.push({ text, html: wrappedHtml });
  }
  return out;
}

export async function parseDocx(
  buffer: Buffer,
  opts: { defaultYear?: number } = {},
): Promise<ParsedTracker> {
  // Explicitly map Bryan's custom Word styles onto heading tags so the parser
  // can distinguish client names from body paragraphs. These styles come from
  // the shared template (rdbvau = title, wrh5ib = date range, dcgtlp/od88zh/
  // x3ppvj/z0ojiu = client heading).
  const styleMap = [
    "p[style-name='rdbvau'] => h1:fresh",
    "p[style-name='wrh5ib'] => h2:fresh",
    "p[style-name='dcgtlp'] => h3:fresh",
    "p[style-name='od88zh'] => h3:fresh",
    "p[style-name='x3ppvj'] => h3:fresh",
    "p[style-name='z0ojiu'] => h3:fresh",
    "p[style-name='ablt93'] => h4:fresh",
  ];
  const result = await mammoth.convertToHtml({ buffer }, { styleMap });
  const paragraphs = getParagraphs(result.value);
  const defaultYear = opts.defaultYear ?? new Date().getFullYear();

  const clientsByName = new Map<string, ParsedClient>();
  const weeklyUpdates: ParsedWeeklyUpdate[] = [];
  const activities: ParsedActivity[] = [];
  const notes: string[] = [];

  // Split into 2 sections — "Weekly Updates" above, "List of Works" below.
  const lowerTexts = paragraphs.map((p) => p.text.toLowerCase());
  const listOfWorksIdx = lowerTexts.findIndex((t) => /^list of works\b/.test(t));

  const weeklySection =
    listOfWorksIdx >= 0 ? paragraphs.slice(0, listOfWorksIdx) : paragraphs;
  const worksSection =
    listOfWorksIdx >= 0 ? paragraphs.slice(listOfWorksIdx + 1) : [];

  // ─── Pass 1: Weekly updates ────────────────────────────────────────────────
  let currentWeek: { start: Date; label: string } | null = null;
  let currentClient: string | null = null;
  let pendingBullets: string[] = [];

  function flushWeekBullets() {
    if (currentWeek && currentClient && pendingBullets.length > 0) {
      weeklyUpdates.push({
        clientName: currentClient,
        weekStart: currentWeek.start,
        weekLabel: currentWeek.label,
        bullets: pendingBullets.slice(),
      });
    }
    pendingBullets = [];
  }

  for (const p of weeklySection) {
    const t = p.text.trim();
    if (!t) continue;

    // Week header?
    const wkDate = weekLabelToDate(t, defaultYear);
    if (wkDate) {
      flushWeekBullets();
      currentClient = null;
      currentWeek = { start: wkDate, label: t };
      continue;
    }

    // Bullet?
    if (looksLikeBullet(t)) {
      if (currentClient) pendingBullets.push(stripBullet(t));
      continue;
    }

    // Continuation of a bullet (starts with "(", lowercase, or no uppercase letter)
    // — append to the last bullet instead of treating as a client name.
    const looksLikeContinuation =
      /^[(\-—–]/.test(t) || /^[a-z]/.test(t) || !/[A-Z]/.test(t);
    if (looksLikeContinuation && currentClient && pendingBullets.length > 0) {
      pendingBullets[pendingBullets.length - 1] += " " + t;
      continue;
    }

    // Otherwise treat as a client name (but only inside a current week,
    // and only if it's short & looks like a proper noun / product name).
    if (
      currentWeek &&
      t.length <= 140 &&
      !t.startsWith("📚") &&
      /^[A-Z0-9]/.test(t)
    ) {
      flushWeekBullets();
      currentClient = t.replace(/\s*\([^)]*\)\s*$/, "").trim();
      registerClient(clientsByName, t);
    }
  }
  flushWeekBullets();

  // ─── Pass 2: List of Works ─────────────────────────────────────────────────
  let curClient: string | null = null;
  let curKind: "ACTIVITY" | "ISSUE_SUPPORT" | "PROGRESS" | null = null;

  for (const p of worksSection) {
    const t = p.text.trim();
    if (!t) continue;
    const tl = t.toLowerCase();

    if (/^activities\b/.test(tl)) {
      curKind = "ACTIVITY";
      continue;
    }
    if (/^issues?\/?(\s|-)?support\b/.test(tl)) {
      curKind = "ISSUE_SUPPORT";
      continue;
    }
    if (/^progress\b/.test(tl)) {
      curKind = "PROGRESS";
      continue;
    }

    // Only paragraphs explicitly styled as headings (via mammoth's styleMap)
    // count as client names. This prevents prose lines from being absorbed.
    if (isHeadingLine(p) && !/^(activities|issues?|progress)\b/i.test(t)) {
      curClient = t.replace(/🆕|📚/g, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
      registerClient(clientsByName, t);
      curKind = null;
      continue;
    }

    if (curClient && curKind) {
      activities.push({
        clientName: curClient,
        kind: curKind,
        body: stripBullet(t),
      });
    } else if (curClient && !curKind) {
      // Lines between client heading and first sub-section header are still
      // meaningful context — default them to ACTIVITY.
      activities.push({
        clientName: curClient,
        kind: "ACTIVITY",
        body: stripBullet(t),
      });
    }
  }

  if (weeklyUpdates.length === 0 && activities.length === 0) {
    notes.push(
      "No weekly-update or list-of-works content was detected. The document may not match the expected template — the importer looks for date-range headings (e.g. \"April 6 – April 10\") and a \"List of Works\" section.",
    );
  }

  return {
    clients: Array.from(clientsByName.values()),
    weeklyUpdates,
    activities,
    notes,
  };
}

function registerClient(map: Map<string, ParsedClient>, rawLine: string): void {
  const name = rawLine.replace(/🆕|📚/g, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (!name || map.has(name)) return;
  const status = inferStatus(rawLine);
  const isNewLead = /\b(new lead|new client)\b/i.test(rawLine);
  map.set(name, {
    name,
    slug: slugify(name),
    status,
    isNewLead,
  });
}

// Re-export for convenience
export { parseWeekInput };
