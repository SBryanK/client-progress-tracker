// Single source of truth for status + priority vocabulary.
//
// We keep a fine-grained list of raw statuses for back-compat with existing
// rows in the DB, but the UI only ever renders three buckets (the user
// consolidated the vocabulary in May 2026):
//
//   • ON_WORK        – live, deep-engagement clients (the default surface)
//   • PARTICIPATING  – everything currently moving but not in deep work
//                       (renamed from ACTIVE; absorbs the old ON_GOING)
//   • IDLE           – paused / on hold / inactive
//
// `toStatusBucket()` is the only function callers should use when deciding
// which badge / colour to render.

export const CLIENT_STATUSES = [
  "ACTIVE",
  "ON_WORK",
  "POTENTIAL",
  "DEAL",
  "PENDING",
  "INACTIVE",
  "ON_HOLD",
  "FINISHED",
  "TERMINATED",
  "LEARNING",
  "SHADOWING",
] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const STATUS_LABEL: Record<ClientStatus, string> = {
  ACTIVE: "Participating",
  ON_WORK: "On-work",
  POTENTIAL: "Participating",
  DEAL: "Participating",
  PENDING: "Participating",
  INACTIVE: "Idle",
  ON_HOLD: "Idle",
  FINISHED: "Participating",
  TERMINATED: "Participating",
  LEARNING: "Participating",
  SHADOWING: "Participating",
};

export const STATUS_TONE: Record<
  ClientStatus,
  "neutral" | "info" | "success" | "warning" | "danger" | "purple"
> = {
  // ON_WORK keeps the purple highlight (deep engagement / "intense" cue).
  // Everything that rolls up into Participating uses the green success
  // tone — it's the "everything healthy" bucket in the 3-bucket model.
  ACTIVE: "success",
  ON_WORK: "purple",
  POTENTIAL: "success",
  DEAL: "success",
  PENDING: "success",
  INACTIVE: "warning",
  ON_HOLD: "warning",
  FINISHED: "success",
  TERMINATED: "success",
  LEARNING: "success",
  SHADOWING: "success",
};

export const CLIENT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type ClientPriority = (typeof CLIENT_PRIORITIES)[number];

export function statusOptions() {
  // Only the three buckets are exposed in forms — owners pick the
  // raw status value that maps cleanly to the bucket they want.
  return [
    { value: "ON_WORK", label: "On-work" },
    { value: "ACTIVE", label: "Participating" },
    { value: "INACTIVE", label: "Idle" },
  ];
}

export function priorityOptions() {
  return CLIENT_PRIORITIES.map((v) => ({
    value: v,
    label: v.charAt(0) + v.slice(1).toLowerCase(),
  }));
}

// ── High-level status buckets (3-bucket model) ───────────────────────
// Order matters — this is the single source of truth for the order in which
// pill-tabs, pipeline tiles and stat cards are rendered. User preference:
// On-work → Participating → Idle. On-work sits first because that's the
// default landing surface (the deep-engagement work the owner cares
// about most right now).
export const STATUS_BUCKETS = [
  "ON_WORK",
  "PARTICIPATING",
  "IDLE",
] as const;
export type StatusBucket = (typeof STATUS_BUCKETS)[number];

export const STATUS_BUCKET_LABEL: Record<StatusBucket, string> = {
  ON_WORK: "On-work",
  PARTICIPATING: "Participating",
  IDLE: "Idle",
};

export const STATUS_BUCKET_TONE: Record<
  StatusBucket,
  "success" | "info" | "neutral" | "warning" | "danger" | "purple"
> = {
  // Per the May 2026 redesign: On-work keeps the purple highlight
  // (deep-engagement cue), Participating moves to the green success
  // tone (the new "everything healthy" bucket), Idle stays warning.
  ON_WORK: "purple",
  PARTICIPATING: "success",
  IDLE: "warning",
};

// Fine-grained → bucket mapping.
export function toStatusBucket(
  s: ClientStatus | string | null | undefined,
): StatusBucket {
  const key = (s ?? "ACTIVE").toString().toUpperCase();
  switch (key) {
    case "ON_WORK":
    case "ONWORK":
    case "ON-WORK":
      return "ON_WORK";
    case "INACTIVE":
    case "ON_HOLD":
    case "IDLE":
    case "LOW_PRIORITY":
      return "IDLE";
    // Everything else — ACTIVE, POTENTIAL, DEAL, FINISHED, LEARNING,
    // SHADOWING, PENDING, TERMINATED, DEAL_CLOSED — rolls up to
    // Participating.
    default:
      return "PARTICIPATING";
  }
}

/**
 * Translate a legacy `?bucket=…` URL value into the current bucket
 * vocabulary so old bookmarks (`/clients?bucket=ACTIVE` or
 * `?bucket=ON_GOING`) keep resolving without a redirect chain.
 *
 * Returns `null` for genuinely unknown values so callers can default
 * to the on-work tile.
 */
export function aliasBucket(
  raw: string | null | undefined,
): StatusBucket | null {
  if (!raw) return null;
  const key = raw.toUpperCase();
  switch (key) {
    case "ON_WORK":
      return "ON_WORK";
    case "PARTICIPATING":
    // Legacy aliases — both fold into Participating.
    case "ACTIVE":
    case "ON_GOING":
    case "ONGOING":
      return "PARTICIPATING";
    case "IDLE":
      return "IDLE";
    default:
      return null;
  }
}

// The fine statuses that roll up into each bucket — used when we need to
// query the DB for "everything in the Participating bucket".
export const BUCKET_TO_STATUSES: Record<StatusBucket, ClientStatus[]> = {
  ON_WORK: ["ON_WORK"],
  IDLE: ["INACTIVE", "ON_HOLD"],
  PARTICIPATING: [
    "ACTIVE",
    "POTENTIAL",
    "DEAL",
    "PENDING",
    "FINISHED",
    "TERMINATED",
    "LEARNING",
    "SHADOWING",
  ],
};
// Coarse heuristic to infer a status from free-text markers while importing.
export function inferStatus(raw: string): ClientStatus {
  const s = raw.toLowerCase();
  if (/\b(idle|inactive|on hold|hold|paused|stuck|low priority)\b/.test(s))
    return "INACTIVE";
  if (/\b(on[- ]?work|deep engagement|priority client|hot)\b/.test(s))
    return "ON_WORK";
  if (/\b(terminated|cancelled|canceled|lost)\b/.test(s)) return "TERMINATED";
  if (/\b(finished|completed|done|live|launched)\b/.test(s)) return "FINISHED";
  if (/\b(shadow|shadowing)\b/.test(s)) return "SHADOWING";
  if (/\b(learning purpose|learning)\b/.test(s)) return "LEARNING";
  if (/\b(new lead|new client|lead|potential)\b/.test(s)) return "POTENTIAL";
  if (/\b(deal|signed|contract)\b/.test(s)) return "DEAL";
  if (/\b(pending|waiting)\b/.test(s)) return "PENDING";
  if (/\b(ongoing|active|poc)\b/.test(s)) return "ACTIVE";
  return "ACTIVE";
}
