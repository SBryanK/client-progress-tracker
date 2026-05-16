// Single source of truth for status + priority vocabulary.
//
// May 2026 redesign — the user moved from a 3-bucket model
// (ON_WORK / PARTICIPATING / IDLE) to a 4-bucket roster model
// (PRIMARY / ASSIST / AKAMAI / INACTIVE) that mirrors how the
// real-world tracker spreadsheet is organised.
//
// `Client.status` now stores the bucket directly. We keep the legacy
// fine-grained values in `CLIENT_STATUSES` so historic rows / API
// payloads / weekly-update snapshots still parse, and `toStatusBucket()`
// folds any legacy value into the right bucket.
//
// `toStatusBucket()` is the only function callers should use when deciding
// which badge / colour / segment to render.

export const CLIENT_STATUSES = [
  // ── New canonical bucket vocabulary (May 2026) ──
  "PRIMARY",
  "ASSIST",
  "AKAMAI",
  "INACTIVE",
  // ── Legacy fine-grained values, kept for back-compat ──
  // Any row/API payload still using these will be folded into a bucket
  // by `toStatusBucket()`. The form/UI only ever writes the new four.
  "ACTIVE",
  "ON_WORK",
  "POTENTIAL",
  "DEAL",
  "PENDING",
  "ON_HOLD",
  "FINISHED",
  "TERMINATED",
  "LEARNING",
  "SHADOWING",
] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const STATUS_LABEL: Record<ClientStatus, string> = {
  PRIMARY: "Primary",
  ASSIST: "Assist",
  AKAMAI: "Akamai",
  INACTIVE: "Inactive",
  // Legacy → fold into the closest bucket label so reports stay readable.
  ACTIVE: "Primary",
  ON_WORK: "Primary",
  POTENTIAL: "Assist",
  DEAL: "Primary",
  PENDING: "Assist",
  ON_HOLD: "Inactive",
  FINISHED: "Inactive",
  TERMINATED: "Inactive",
  LEARNING: "Assist",
  SHADOWING: "Assist",
};

export const STATUS_TONE: Record<
  ClientStatus,
  "neutral" | "info" | "success" | "warning" | "danger" | "purple"
> = {
  // Per the May 2026 roster redesign:
  //   Primary  → emerald (success)  — your top, deep-engagement clients
  //   Assist   → sky/info           — clients you support / partner on
  //   Akamai   → purple             — the Akamai → EdgeOne migration cohort
  //   Inactive → amber (warning)    — paused / dormant
  PRIMARY: "success",
  ASSIST: "info",
  AKAMAI: "purple",
  INACTIVE: "warning",
  // Legacy values map to the same tones via their bucket.
  ACTIVE: "success",
  ON_WORK: "success",
  POTENTIAL: "info",
  DEAL: "success",
  PENDING: "info",
  ON_HOLD: "warning",
  FINISHED: "warning",
  TERMINATED: "warning",
  LEARNING: "info",
  SHADOWING: "info",
};

export const CLIENT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type ClientPriority = (typeof CLIENT_PRIORITIES)[number];

// ── Bucket vocabulary (the only thing the UI surfaces) ───────────────
// Order matters — this is the single source of truth for the order in
// which pill-tabs, pipeline tiles and stat cards are rendered.
// Default landing tab is PRIMARY.
export const STATUS_BUCKETS = [
  "PRIMARY",
  "ASSIST",
  "AKAMAI",
  "INACTIVE",
] as const;
export type StatusBucket = (typeof STATUS_BUCKETS)[number];

export const STATUS_BUCKET_LABEL: Record<StatusBucket, string> = {
  PRIMARY: "Primary",
  ASSIST: "Assist",
  AKAMAI: "Akamai",
  INACTIVE: "Inactive",
};

export const STATUS_BUCKET_TONE: Record<
  StatusBucket,
  "success" | "info" | "neutral" | "warning" | "danger" | "purple"
> = {
  PRIMARY: "success",
  ASSIST: "info",
  AKAMAI: "purple",
  INACTIVE: "warning",
};

/**
 * Default bucket pre-selected in the "New client" form.
 * Override with `NEXT_PUBLIC_DEFAULT_BUCKET` (one of the four). Falls
 * back to PRIMARY because most new clients you add are primary by intent.
 */
export function defaultBucket(): StatusBucket {
  const raw = (process.env.NEXT_PUBLIC_DEFAULT_BUCKET ?? "").toUpperCase();
  if ((STATUS_BUCKETS as readonly string[]).includes(raw)) {
    return raw as StatusBucket;
  }
  return "PRIMARY";
}

export function statusOptions() {
  // The form only exposes the four bucket values — everything legacy
  // is folded by `toStatusBucket()` for display and migrated by the
  // bucket-migration script for storage.
  return [
    { value: "PRIMARY", label: "Primary" },
    { value: "ASSIST", label: "Assist" },
    { value: "AKAMAI", label: "Akamai" },
    { value: "INACTIVE", label: "Inactive" },
  ];
}

/** Alias for `statusOptions()` — clearer at the call site when the form
 *  field is labelled "Bucket". */
export const bucketOptions = statusOptions;

export function priorityOptions() {
  return CLIENT_PRIORITIES.map((v) => ({
    value: v,
    label: v.charAt(0) + v.slice(1).toLowerCase(),
  }));
}

// ── Fine-grained → bucket mapping ───────────────────────────────────
// Folds every historical / legacy value into one of the four buckets so
// rows that haven't been migrated yet still render in the right column.
export function toStatusBucket(
  s: ClientStatus | string | null | undefined,
): StatusBucket {
  const key = (s ?? "PRIMARY").toString().toUpperCase().replace(/[\s-]/g, "_");
  switch (key) {
    case "PRIMARY":
    case "ON_WORK":
    case "ONWORK":
    case "DEAL":
      return "PRIMARY";
    case "ASSIST":
    case "ACTIVE":
    case "POTENTIAL":
    case "PENDING":
    case "LEARNING":
    case "SHADOWING":
      return "ASSIST";
    case "AKAMAI":
      return "AKAMAI";
    case "INACTIVE":
    case "ON_HOLD":
    case "IDLE":
    case "FINISHED":
    case "TERMINATED":
    case "LOW_PRIORITY":
      return "INACTIVE";
    default:
      // Conservative fallback: unknown legacy value → PRIMARY rather
      // than dropping the row into Inactive (visibility over silence).
      return "PRIMARY";
  }
}

/**
 * Translate a legacy `?bucket=…` URL value into the current bucket
 * vocabulary so old bookmarks (`/clients?bucket=ON_WORK`,
 * `?bucket=PARTICIPATING`, `?bucket=IDLE`, etc.) keep resolving without
 * a redirect chain.
 *
 * Returns `null` for genuinely unknown values so callers can default
 * to the Primary tile.
 */
export function aliasBucket(
  raw: string | null | undefined,
): StatusBucket | null {
  if (!raw) return null;
  const key = raw.toUpperCase();
  switch (key) {
    case "PRIMARY":
      return "PRIMARY";
    case "ASSIST":
      return "ASSIST";
    case "AKAMAI":
      return "AKAMAI";
    case "INACTIVE":
      return "INACTIVE";
    // Legacy 3-bucket aliases — fold into the closest new bucket.
    case "ON_WORK":
      return "PRIMARY";
    case "PARTICIPATING":
    case "ACTIVE":
    case "ON_GOING":
    case "ONGOING":
      return "ASSIST";
    case "IDLE":
    case "ON_HOLD":
      return "INACTIVE";
    default:
      return null;
  }
}

// The fine statuses that roll up into each bucket — used when we need to
// query the DB for "every row in the Primary bucket" (covers both rows
// already migrated to PRIMARY and any legacy row that still maps there).
export const BUCKET_TO_STATUSES: Record<StatusBucket, ClientStatus[]> = {
  PRIMARY: ["PRIMARY", "ON_WORK", "DEAL"],
  ASSIST: ["ASSIST", "ACTIVE", "POTENTIAL", "PENDING", "LEARNING", "SHADOWING"],
  AKAMAI: ["AKAMAI"],
  INACTIVE: ["INACTIVE", "ON_HOLD", "FINISHED", "TERMINATED"],
};

// Coarse heuristic to infer a status from free-text markers while importing.
export function inferStatus(raw: string): ClientStatus {
  const s = raw.toLowerCase();
  if (/\b(akamai)\b/.test(s)) return "AKAMAI";
  if (
    /\b(idle|inactive|on hold|hold|paused|stuck|low priority|terminated|cancelled|canceled|lost|finished|completed|done|live|launched)\b/.test(
      s,
    )
  )
    return "INACTIVE";
  if (/\b(primary|on[- ]?work|deep engagement|priority client|hot|deal|signed|contract)\b/.test(s))
    return "PRIMARY";
  if (
    /\b(assist|new lead|new client|lead|potential|pending|waiting|shadow|shadowing|learning purpose|learning|ongoing|active|poc)\b/.test(
      s,
    )
  )
    return "ASSIST";
  return "PRIMARY";
}
