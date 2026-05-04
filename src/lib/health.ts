// Transparent, explainable Client Health Score — 0..100.
// Every factor has a defined weight & range so the UI can show a per-factor breakdown.
import { differenceInCalendarDays } from "date-fns";
import type { ClientStatus, ClientPriority } from "@/lib/status";

export type HealthInput = {
  status: ClientStatus;
  priority: ClientPriority;
  lastUpdateAt?: Date | null;
  hasBlockers: boolean;
  hasNextAction: boolean;
  recentUpdateCount: number; // last 30 days
};

export type HealthFactor = {
  key: string;
  label: string;
  score: number; // 0..max
  max: number;
  note: string;
};

export type HealthResult = {
  score: number; // 0..100
  band: "HEALTHY" | "ATTENTION" | "AT_RISK" | "BLOCKED";
  bandLabel: string;
  tone: "success" | "info" | "warning" | "danger";
  factors: HealthFactor[];
};

export function computeHealth(input: HealthInput): HealthResult {
  const factors: HealthFactor[] = [];

  // 1) Recency of last update — 30 points.
  const days =
    input.lastUpdateAt != null
      ? differenceInCalendarDays(new Date(), input.lastUpdateAt)
      : 999;
  let recencyScore = 0;
  let recencyNote = "No updates logged yet";
  if (days <= 7) {
    recencyScore = 30;
    recencyNote = `Updated ${days} day(s) ago`;
  } else if (days <= 14) {
    recencyScore = 22;
    recencyNote = `Updated ${days} day(s) ago`;
  } else if (days <= 30) {
    recencyScore = 12;
    recencyNote = `Updated ${days} day(s) ago — getting stale`;
  } else if (days <= 60) {
    recencyScore = 4;
    recencyNote = `Last update ${days} day(s) ago`;
  }
  factors.push({
    key: "recency",
    label: "Update recency",
    score: recencyScore,
    max: 30,
    note: recencyNote,
  });

  // 2) Status — 25 points.
  const statusTable: Record<ClientStatus, number> = {
    ACTIVE: 25,
    DEAL: 24,
    FINISHED: 20,
    POTENTIAL: 18,
    LEARNING: 14,
    SHADOWING: 14,
    PENDING: 10,
    ON_HOLD: 6,
    INACTIVE: 3,
    TERMINATED: 0,
  };
  const statusScore = statusTable[input.status];
  factors.push({
    key: "status",
    label: "Status",
    score: statusScore,
    max: 25,
    note: `Current status contributes ${statusScore}/25`,
  });

  // 3) Blockers — −15 if present, +15 if clear.
  const blockerScore = input.hasBlockers ? 0 : 15;
  factors.push({
    key: "blockers",
    label: "Blockers",
    score: blockerScore,
    max: 15,
    note: input.hasBlockers ? "Active blockers logged" : "No blockers flagged",
  });

  // 4) Next action defined — 10 points.
  const nextActionScore = input.hasNextAction ? 10 : 0;
  factors.push({
    key: "nextAction",
    label: "Next action",
    score: nextActionScore,
    max: 10,
    note: input.hasNextAction ? "Next step documented" : "No next action set",
  });

  // 5) Momentum — updates in last 30 days — up to 10 points (capped at 4 updates).
  const momentumScore = Math.min(input.recentUpdateCount, 4) * 2.5;
  factors.push({
    key: "momentum",
    label: "Momentum (30d)",
    score: momentumScore,
    max: 10,
    note: `${input.recentUpdateCount} update(s) in the last 30 days`,
  });

  // 6) Priority boost — LOW 0, MEDIUM 4, HIGH 7, CRITICAL 10.
  const priMap: Record<ClientPriority, number> = {
    LOW: 0,
    MEDIUM: 4,
    HIGH: 7,
    CRITICAL: 10,
  };
  const priScore = priMap[input.priority];
  factors.push({
    key: "priority",
    label: "Priority weighting",
    score: priScore,
    max: 10,
    note: `Priority = ${input.priority.toLowerCase()}`,
  });

  const raw = factors.reduce((s, f) => s + f.score, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  let band: HealthResult["band"] = "BLOCKED";
  let bandLabel = "Blocked / Inactive";
  let tone: HealthResult["tone"] = "danger";
  if (score >= 80) {
    band = "HEALTHY";
    bandLabel = "Healthy";
    tone = "success";
  } else if (score >= 60) {
    band = "ATTENTION";
    bandLabel = "Needs attention";
    tone = "info";
  } else if (score >= 40) {
    band = "AT_RISK";
    bandLabel = "At risk";
    tone = "warning";
  }

  return { score, band, bandLabel, tone, factors };
}
