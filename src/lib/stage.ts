// Engagement-stage taxonomy — 7 ordered stages from initial contact
// through end-of-life. This sits alongside the status bucket vocabulary
// (`src/lib/status.ts`):
//
//   • status / bucket  → describes how much *attention* the client gets right
//                         now (On-work / Participating / Idle).
//   • stage           → describes the *maturity* of the engagement,
//                         independent of attention (Engagement → Production
//                         → Discontinued).
//
// A client can be Participating + POC, On-work + Production, Idle +
// Aftersales, etc. The two dimensions are intentionally orthogonal.

export const CLIENT_STAGES = [
  "ENGAGEMENT",
  "PREPARE_POC",
  "POC",
  "FINISH_POC",
  "PRODUCTION",
  "AFTERSALES_PROGRESS",
  "DISCONTINUED",
] as const;

export type ClientStage = (typeof CLIENT_STAGES)[number];

export const STAGE_LABEL: Record<ClientStage, string> = {
  ENGAGEMENT: "Engagement",
  PREPARE_POC: "Prepare POC",
  POC: "POC",
  FINISH_POC: "Finish POC",
  PRODUCTION: "Production",
  AFTERSALES_PROGRESS: "Aftersales Progress",
  DISCONTINUED: "Discontinued",
};

/**
 * Tone for the stage chip — chosen so the seven stages read as a
 * logical journey:
 *   neutral → info → info → info → success → success → danger.
 * (Engagement is neutral because no commitment yet; POC family is info
 * because it's actively in flight; Production / Aftersales are success
 * because the client is paying / live; Discontinued is danger.)
 */
export const STAGE_TONE: Record<
  ClientStage,
  "neutral" | "info" | "success" | "warning" | "danger" | "purple"
> = {
  ENGAGEMENT: "neutral",
  PREPARE_POC: "info",
  POC: "info",
  FINISH_POC: "info",
  PRODUCTION: "success",
  AFTERSALES_PROGRESS: "success",
  DISCONTINUED: "danger",
};

export function stageOptions() {
  return CLIENT_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }));
}

/**
 * Coarse heuristic to map free-text stage notes / imported labels
 * onto the new enumerated taxonomy. Returns `ENGAGEMENT` as a safe
 * default when nothing matches.
 */
export function inferStage(raw: string | null | undefined): ClientStage {
  if (!raw) return "ENGAGEMENT";
  const s = raw.toLowerCase();
  if (/\b(discontinu|cancelled|canceled|terminat|lost|dropped)\b/.test(s))
    return "DISCONTINUED";
  if (/\b(after[-\s]?sales|after-?go-?live|support phase|expansion|upsell)\b/.test(s))
    return "AFTERSALES_PROGRESS";
  if (/\b(production|prod|live|launched|go[-\s]?live|live in production)\b/.test(s))
    return "PRODUCTION";
  if (/\b(finish[-\s]?poc|poc[-\s]?complete|poc done|poc finished|post[-\s]?poc)\b/.test(s))
    return "FINISH_POC";
  if (/\b(poc|proof of concept|pilot)\b/.test(s)) return "POC";
  if (/\b(prepare|preparation|pre[-\s]?poc|kick[-\s]?off|ramp[-\s]?up|onboard)\b/.test(s))
    return "PREPARE_POC";
  if (/\b(engage|engagement|first contact|initial|qualif|lead|discovery)\b/.test(s))
    return "ENGAGEMENT";
  // Migration projects are typically running in production from day 1.
  if (/\b(migration|cutover)\b/.test(s)) return "PRODUCTION";
  return "ENGAGEMENT";
}
