"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

type Scope =
  | "DATE_RANGE"
  | "CLIENT"
  | "STATUS"
  | "HIGH_PRIORITY"
  | "BLOCKERS"
  | "MANAGER_SUMMARY"
  | "ACTIVE_ONLY";

type Format = "docx" | "pdf" | "xlsx" | "md";

const SCOPES: { value: Scope; label: string; hint: string }[] = [
  {
    value: "DATE_RANGE",
    label: "By date range",
    hint: "Every weekly update whose week starts in the chosen range.",
  },
  {
    value: "CLIENT",
    label: "Client-specific",
    hint: "All history for a single client (optionally limited to a date range).",
  },
  {
    value: "STATUS",
    label: "Status-based",
    hint: "All clients in a given status.",
  },
  {
    value: "ACTIVE_ONLY",
    label: "Active clients only",
    hint: "Shortcut for Status=Active.",
  },
  {
    value: "HIGH_PRIORITY",
    label: "High priority only",
    hint: "Priority High or Critical.",
  },
  {
    value: "BLOCKERS",
    label: "Blockers only",
    hint: "Updates where a blocker is recorded.",
  },
  {
    value: "MANAGER_SUMMARY",
    label: "Manager-friendly summary",
    hint: "One-line highlights per client.",
  },
];

const FORMATS: { value: Format; label: string }[] = [
  { value: "docx", label: "Word (.docx)" },
  { value: "pdf", label: "PDF" },
  { value: "xlsx", label: "Excel (.xlsx)" },
  { value: "md", label: "Markdown" },
];

export function ReportsPanel({
  clients,
  statuses,
}: {
  clients: { id: string; name: string; slug: string }[];
  statuses: { value: string; label: string }[];
}) {
  const [scope, setScope] = useState<Scope>("DATE_RANGE");
  const [format, setFormat] = useState<Format>("docx");
  const [clientSlug, setClientSlug] = useState<string>(clients[0]?.slug ?? "");
  const [status, setStatus] = useState<string>("ACTIVE");

  // Default date range: last 30 days ending today, UTC.
  const today = useMemo(() => new Date(), []);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const defaultTo = fmt(today);
  const defaultFrom = fmt(new Date(today.getTime() - 30 * 86400000));
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      if ((scope === "DATE_RANGE" || scope === "CLIENT") && from > to) {
        throw new Error("The 'From' date must be on or before the 'To' date.");
      }
      const params = new URLSearchParams({ scope, format });
      if (scope === "CLIENT") {
        params.set("client", clientSlug);
        params.set("from", from);
        params.set("to", to);
      }
      if (scope === "STATUS") params.set("status", status);
      if (scope === "DATE_RANGE") {
        params.set("from", from);
        params.set("to", to);
      }

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? `Failed (${res.status})`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const fnMatch = /filename="([^"]+)"/.exec(cd);
      const filename = fnMatch?.[1] ?? `report.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  const selectedScope = SCOPES.find((s) => s.value === scope)!;
  const needsRange = scope === "DATE_RANGE" || scope === "CLIENT";

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Report scope"
          options={SCOPES.map(({ value, label }) => ({ value, label }))}
          value={scope}
          onChange={(e) => setScope(e.target.value as Scope)}
          hint={selectedScope.hint}
        />
        <Select
          label="Format"
          options={FORMATS.map(({ value, label }) => ({ value, label }))}
          value={format}
          onChange={(e) => setFormat(e.target.value as Format)}
        />
      </div>

      {scope === "CLIENT" ? (
        <Select
          label="Client"
          options={clients.map((c) => ({ value: c.slug, label: c.name }))}
          value={clientSlug}
          onChange={(e) => setClientSlug(e.target.value)}
        />
      ) : null}
      {scope === "STATUS" ? (
        <Select
          label="Status"
          options={statuses}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
      ) : null}
      {needsRange ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="From"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div>
        <Button onClick={run} disabled={busy} size="lg">
          {busy ? "Generating…" : "Download report"}
        </Button>
      </div>
    </div>
  );
}
