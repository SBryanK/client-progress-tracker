// Single source of truth for status + priority vocabulary.
//
// We keep a fine-grained list of raw statuses for back-compat with existing
// rows in the DB, but the UI only ever renders three buckets:
//
//   • ACTIVE    – currently moving
//   • IDLE      – paused / low priority / on hold / inactive
//   • ON_GOING  – long-running, learning, shadowing, pending, terminated,
//                 signed contract, potential leads, finished — everything
//                 else goes here (per user's unified bucket choice).
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
  ACTIVE: "Active",
  ON_WORK: "On-work",
  POTENTIAL: "On-going",
  DEAL: "On-going",
  PENDING: "On-going",
  INACTIVE: "Idle",
  ON_HOLD: "Idle",
  FINISHED: "On-going",
  TERMINATED: "On-going",
  LEARNING: "On-going",
  SHADOWING: "On-going",
};

export const STATUS_TONE: Record<
  ClientStatus,
  "neutral" | "info" | "success" | "warning" | "danger" | "purple"
> = {
  ACTIVE: "success",
  ON_WORK: "purple",
  POTENTIAL: "info",
  DEAL: "info",
  PENDING: "info",
  INACTIVE: "warning",
  ON_HOLD: "warning",
  FINISHED: "info",
  TERMINATED: "info",
  LEARNING: "info",
  SHADOWING: "info",
};

export const CLIENT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type ClientPriority = (typeof CLIENT_PRIORITIES)[number];

export function statusOptions() {
  // Only the four buckets are exposed in forms.
  return [
    { value: "ACTIVE", label: "Active" },
    { value: "ON_WORK", label: "On-work" },
    { value: "POTENTIAL", label: "On-going" },
    { value: "INACTIVE", label: "Idle" },
  ];
}

export function priorityOptions() {
  return CLIENT_PRIORITIES.map((v) => ({
    value: v,
    label: v.charAt(0) + v.slice(1).toLowerCase(),
  }));
}

// ── High-level status buckets (4-bucket model) ───────────────────────
// Order matters — this is the single source of truth for the order in which
// pill-tabs, pipeline tiles and stat cards are rendered. User preference:
// Active → On-work → On-going → Idle.  "On-work" sits between Active and
// On-going to highlight the clients in *deep, intense* engagement right now.
export const STATUS_BUCKETS = ["ACTIVE", "ON_WORK", "ON_GOING", "IDLE"] as const;
export type StatusBucket = (typeof STATUS_BUCKETS)[number];

export const STATUS_BUCKET_LABEL: Record<StatusBucket, string> = {
  ACTIVE: "Active",
  ON_WORK: "On-work",
  IDLE: "Idle",
  ON_GOING: "On-going",
};

export const STATUS_BUCKET_TONE: Record<
  StatusBucket,
  "success" | "info" | "neutral" | "warning" | "danger" | "purple"
> = {
  ACTIVE: "success",
  ON_WORK: "purple",
  IDLE: "warning",
  ON_GOING: "info",
};

// Fine-grained → bucket mapping.
export function toStatusBucket(
  s: ClientStatus | string | null | undefined,
): StatusBucket {
  const key = (s ?? "ACTIVE").toString().toUpperCase();
  switch (key) {
    case "ACTIVE":
      return "ACTIVE";
    case "ON_WORK":
    case "ONWORK":
    case "ON-WORK":
      return "ON_WORK";
    case "INACTIVE":
    case "ON_HOLD":
    case "IDLE":
    case "LOW_PRIORITY":
      return "IDLE";
    // Everything else — POTENTIAL, DEAL, FINISHED, LEARNING, SHADOWING,
    // PENDING, TERMINATED, DEAL_CLOSED — rolls up to On-going.
    default:
      return "ON_GOING";
  }
}

// The fine statuses that roll up into each bucket — used when we need to
// query the DB for "everything in the Active bucket".
export const BUCKET_TO_STATUSES: Record<StatusBucket, ClientStatus[]> = {
  ACTIVE: ["ACTIVE"],
  ON_WORK: ["ON_WORK"],
  IDLE: ["INACTIVE", "ON_HOLD"],
  ON_GOING: [
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
