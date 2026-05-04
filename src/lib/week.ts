// ISO-week helpers — all weeks start on Monday (UTC).
import { format, parse, startOfWeek, addDays, isValid, getISOWeek, getISOWeekYear } from "date-fns";

const WEEK_START = 1; // Monday

export function toWeekStart(d: Date): Date {
  const s = startOfWeek(d, { weekStartsOn: WEEK_START });
  // normalise to UTC midnight so all rows compare cleanly
  return new Date(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate()));
}

export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 4); // Mon–Fri working week by default
  const sameMonth = weekStart.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) {
    return `${format(weekStart, "MMM d")} – ${format(end, "d")}`;
  }
  return `${format(weekStart, "MMM d")} – ${format(end, "MMM d")}`;
}

export function isoWeekLabel(weekStart: Date): string {
  const yr = getISOWeekYear(weekStart);
  const wk = getISOWeek(weekStart);
  return `${yr}-W${String(wk).padStart(2, "0")}`;
}

// Parse "2025-04-07" or "2025-W15" into a week-start Date (UTC Monday).
export function parseWeekInput(raw: string): Date | null {
  const s = raw.trim();
  // ISO week form: "2025-W15"
  const isoWk = /^(\d{4})-W(\d{1,2})$/.exec(s);
  if (isoWk) {
    const year = Number(isoWk[1]);
    const week = Number(isoWk[2]);
    // Jan 4th is always in ISO week 1 — compute from there.
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Monday = toWeekStart(jan4);
    const d = addDays(jan4Monday, (week - 1) * 7);
    return isValid(d) ? toWeekStart(d) : null;
  }
  const d = parse(s, "yyyy-MM-dd", new Date());
  if (!isValid(d)) return null;
  return toWeekStart(d);
}
