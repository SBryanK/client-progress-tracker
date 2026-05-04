"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type ImportResult = {
  importedClients: number;
  importedUpdates: number;
  importedActivities: number;
  notes?: string;
};

export function ImportPanel() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Import failed (${res.status})`);
      setResult(body as ImportResult);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" aria-busy={busy}>
      <div>
        <label htmlFor="file" className="text-sm font-medium text-fg">
          File
        </label>
        <input
          id="file"
          type="file"
          accept=".docx,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1.5 block w-full text-sm text-fg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent file:text-accent-fg hover:file:bg-accent-hover file:cursor-pointer"
        />
        <p className="mt-1 text-xs text-fg-subtle">
          .docx is parsed by headings + paragraphs; .xlsx imports one row per
          weekly update.
        </p>
      </div>

      {error ? (
        <div role="alert" className="text-sm text-danger">
          {error}
        </div>
      ) : null}

      {result ? (
        <div
          role="status"
          className="rounded-lg border border-success/40 bg-success/10 text-success p-3 text-sm"
        >
          Imported <strong>{result.importedClients}</strong> client(s),{" "}
          <strong>{result.importedUpdates}</strong> weekly update(s), and{" "}
          <strong>{result.importedActivities}</strong> activity entr(ies).
          {result.notes ? <p className="mt-1 text-xs opacity-80">{result.notes}</p> : null}
        </div>
      ) : null}

      <div>
        <Button type="submit" disabled={busy || !file}>
          {busy ? "Importing..." : "Import file"}
        </Button>
      </div>
    </form>
  );
}
