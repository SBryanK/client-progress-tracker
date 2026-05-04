// Pull report data from the DB based on scope.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { addDays, addMonths, startOfMonth, endOfMonth, parse, isValid } from "date-fns";
import { parseWeekInput, toWeekStart } from "@/lib/week";
import type { ClientStatus } from "@/lib/status";

export type ReportScope =
  | { kind: "DATE_RANGE"; from: Date; to: Date }
  | { kind: "WEEKLY_ALL"; weekStart: Date }
  | { kind: "MONTHLY_ALL"; month: Date /* first-of-month */ }
  | { kind: "CLIENT"; clientSlug: string; from?: Date; to?: Date }
  | { kind: "STATUS"; status: string }
  | { kind: "ACTIVE_ONLY" }
  | { kind: "HIGH_PRIORITY" }
  | { kind: "BLOCKERS" }
  | { kind: "MANAGER_SUMMARY" };

export function parseScope(sp: URLSearchParams): ReportScope {
  const kind = (sp.get("scope") ?? "DATE_RANGE") as ReportScope["kind"];
  const fromRaw = sp.get("from");
  const toRaw = sp.get("to");
  // Returns a UTC Date at either start (00:00:00.000) or end (23:59:59.999)
  // of the given `yyyy-MM-dd` string. Using end-of-day for the upper bound
  // keeps the DB comparison (`lte`) inclusive of any update logged on that
  // day regardless of its time-of-day.
  const parseDate = (
    s: string | null,
    fallback: Date,
    mode: "start" | "end" = "start",
  ): Date => {
    if (!s) return fallback;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return fallback;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const ms =
      mode === "end"
        ? Date.UTC(y, mo, d, 23, 59, 59, 999)
        : Date.UTC(y, mo, d);
    const date = new Date(ms);
    return isValid(date) ? date : fallback;
  };
  switch (kind) {
    case "DATE_RANGE": {
      const now = new Date();
      const todayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const todayEnd = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          23,
          59,
          59,
          999,
        ),
      );
      const defaultFrom = addDays(todayStart, -30);
      const from = parseDate(fromRaw, defaultFrom, "start");
      const to = parseDate(toRaw, todayEnd, "end");
      return { kind: "DATE_RANGE", from, to };
    }
    case "WEEKLY_ALL": {
      const ws = sp.get("weekStart");
      const d = ws ? parseWeekInput(ws) : toWeekStart(new Date());
      return { kind: "WEEKLY_ALL", weekStart: d ?? toWeekStart(new Date()) };
    }
    case "MONTHLY_ALL": {
      const raw = sp.get("month");
      const d = raw ? parse(raw + "-01", "yyyy-MM-dd", new Date()) : new Date();
      const month = isValid(d) ? startOfMonth(d) : startOfMonth(new Date());
      return { kind: "MONTHLY_ALL", month };
    }
    case "CLIENT": {
      const from = fromRaw ? parseDate(fromRaw, new Date(0), "start") : undefined;
      const to = toRaw ? parseDate(toRaw, new Date(), "end") : undefined;
      return { kind: "CLIENT", clientSlug: sp.get("client") ?? "", from, to };
    }
    case "STATUS": {
      return { kind: "STATUS", status: sp.get("status") ?? "ACTIVE" };
    }
    case "ACTIVE_ONLY":
    case "HIGH_PRIORITY":
    case "BLOCKERS":
    case "MANAGER_SUMMARY":
      return { kind };
    default: {
      const now = new Date();
      const todayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const todayEnd = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          23,
          59,
          59,
          999,
        ),
      );
      return {
        kind: "DATE_RANGE",
        from: addDays(todayStart, -30),
        to: todayEnd,
      };
    }
  }
}

export type ReportRow = {
  client: {
    id: string;
    name: string;
    slug: string;
    status: string;
    priority: string;
    summary: string | null;
    stage: string | null;
    region: string | null;
    bdOwner: string | null;
  };
  updates: {
    id: string;
    weekStart: Date;
    weekLabel: string;
    bullets: string;
    highlights: string | null;
    blockers: string | null;
    nextAction: string | null;
  }[];
};

export type ReportData = {
  title: string;
  subtitle: string;
  scope: ReportScope;
  rows: ReportRow[];
};

export async function fetchReport(
  ownerIds: string[],
  scope: ReportScope,
): Promise<ReportData> {
  let title = "Weekly Client Progress Report";
  let subtitle = "";

  // Single-tenant scope — any of the configured OWNER emails' user ids.
  const ownerFilter = ownerIds.length
    ? { in: ownerIds }
    : { in: ["__none__"] };

  const clientWhere: Prisma.ClientWhereInput = {
    ownerId: ownerFilter,
    archived: false,
  };

  let updateWhere: Prisma.WeeklyUpdateWhereInput = {
    client: { ownerId: ownerFilter, archived: false },
  };

  if (scope.kind === "DATE_RANGE") {
    updateWhere = {
      ...updateWhere,
      weekStart: { gte: scope.from, lte: scope.to },
    };
    title = "Client Progress Report";
    subtitle = `${scope.from.toISOString().slice(0, 10)} → ${scope.to.toISOString().slice(0, 10)}`;
  } else if (scope.kind === "WEEKLY_ALL") {
    const from = scope.weekStart;
    const to = addDays(from, 7);
    updateWhere = {
      ...updateWhere,
      weekStart: { gte: from, lt: to },
    };
    title = "Weekly Client Progress Report";
    subtitle = `Week of ${from.toISOString().slice(0, 10)}`;
  } else if (scope.kind === "MONTHLY_ALL") {
    const from = startOfMonth(scope.month);
    const to = endOfMonth(scope.month);
    updateWhere = {
      ...updateWhere,
      weekStart: { gte: from, lte: to },
    };
    title = "Monthly Client Progress Report";
    subtitle = from.toISOString().slice(0, 7);
  } else if (scope.kind === "CLIENT") {
    clientWhere.slug = scope.clientSlug;
    updateWhere = {
      ...updateWhere,
      client: { ownerId: ownerFilter, archived: false, slug: scope.clientSlug },
      ...(scope.from && scope.to
        ? { weekStart: { gte: scope.from, lte: scope.to } }
        : {}),
    };
    title = "Client Progress Report";
    subtitle = scope.clientSlug;
  } else if (scope.kind === "STATUS") {
    clientWhere.status = scope.status;
    updateWhere = {
      ...updateWhere,
      client: { ownerId: ownerFilter, archived: false, status: scope.status },
    };
    title = `Client Progress Report — ${scope.status}`;
    subtitle = "Filtered by status";
  } else if (scope.kind === "ACTIVE_ONLY") {
    clientWhere.status = "ACTIVE";
    updateWhere = {
      ...updateWhere,
      client: { ownerId: ownerFilter, archived: false, status: "ACTIVE" },
    };
    title = "Active Clients — Progress Report";
    subtitle = "";
  } else if (scope.kind === "HIGH_PRIORITY") {
    clientWhere.priority = { in: ["HIGH", "CRITICAL"] };
    updateWhere = {
      ...updateWhere,
      client: {
        ownerId: ownerFilter,
        archived: false,
        priority: { in: ["HIGH", "CRITICAL"] },
      },
    };
    title = "High Priority Clients — Progress Report";
    subtitle = "";
  } else if (scope.kind === "BLOCKERS") {
    updateWhere = {
      ...updateWhere,
      NOT: [{ blockers: null }, { blockers: "" }],
    };
    title = "Blockers Report";
    subtitle = "Every weekly entry with a recorded blocker.";
  } else if (scope.kind === "MANAGER_SUMMARY") {
    // no extra filter — we'll squash to one line per client
    title = "Manager Summary";
    subtitle = "Latest highlights per client.";
  }

  const [clients, updates] = await Promise.all([
    prisma.client.findMany({
      where: clientWhere,
      orderBy: { name: "asc" },
    }),
    prisma.weeklyUpdate.findMany({
      where: updateWhere,
      orderBy: { weekStart: "desc" },
    }),
  ]);

  const byClient = new Map<string, ReportRow["updates"]>();
  for (const u of updates) {
    const arr = byClient.get(u.clientId) ?? [];
    arr.push({
      id: u.id,
      weekStart: u.weekStart,
      weekLabel: u.weekLabel,
      bullets: u.bullets,
      highlights: u.highlights,
      blockers: u.blockers,
      nextAction: u.nextAction,
    });
    byClient.set(u.clientId, arr);
  }

  let rows: ReportRow[] = clients.map((c) => ({
    client: {
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      priority: c.priority,
      summary: c.summary,
      stage: c.stage,
      region: c.region,
      bdOwner: c.bdOwner,
    },
    updates: byClient.get(c.id) ?? [],
  }));

  // Manager summary: keep only the most-recent update per client; drop empty clients.
  if (scope.kind === "MANAGER_SUMMARY") {
    rows = rows
      .map((r) => ({ ...r, updates: r.updates.slice(0, 1) }))
      .filter((r) => r.updates.length > 0);
  }

  // For the date-range / weekly / monthly / status / blockers scopes we only
  // want clients with updates in the filter window — otherwise the report
  // is noisy.  The CLIENT scope keeps even no-update clients so the
  // generated document clearly shows "no updates in range".
  if (
    scope.kind !== "CLIENT" &&
    scope.kind !== "ACTIVE_ONLY" &&
    scope.kind !== "HIGH_PRIORITY"
  ) {
    rows = rows.filter((r) => r.updates.length > 0);
  }

  return { title, subtitle, scope, rows };
}

// Re-export helpers used by exporters.
export { addDays, addMonths };
