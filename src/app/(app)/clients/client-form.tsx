"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import {
  bucketOptions,
  defaultBucket,
  priorityOptions,
} from "@/lib/status";
import { stageOptions } from "@/lib/stage";

export type ClientFormValues = {
  id?: string;
  name: string;
  status: string;
  priority: string;
  stage?: string | null;
  /** Enumerated lifecycle stage — see src/lib/stage.ts. */
  stageKey?: string;
  bdOwner?: string | null;
  region?: string | null;
  industry?: string | null;
  accountValue?: string | null;
  /** Free-form revenue estimate, e.g. "~$350K/yr". */
  revenueEstimate?: string | null;
  /** YYYY-MM-DD or empty string. */
  firstEngagementOn?: string | null;
  /** YYYY-MM-DD or empty string. */
  signedOn?: string | null;
  summary?: string | null;
  notes?: string | null;
  tags?: string | null;
  isNewLead?: boolean;
};

export function ClientForm({
  initial,
  mode = "create",
}: {
  initial?: ClientFormValues;
  mode?: "create" | "edit";
}) {
  const router = useRouter();
  const [values, setValues] = useState<ClientFormValues>(
    initial ?? {
      name: "",
      status: defaultBucket(),
      priority: "MEDIUM",
      stage: "",
      stageKey: "ENGAGEMENT",
      bdOwner: "",
      region: "",
      industry: "",
      accountValue: "",
      revenueEstimate: "",
      firstEngagementOn: "",
      signedOn: "",
      summary: "",
      notes: "",
      tags: "",
      isNewLead: false,
    },
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof ClientFormValues>(key: K, v: ClientFormValues[K]) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url =
        mode === "edit" && initial?.id
          ? `/api/clients/${initial.id}`
          : "/api/clients";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const saved = (await res.json()) as { slug: string };
      router.push(`/clients/${saved.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" aria-busy={saving}>
      <Input
        label="Name"
        required
        value={values.name}
        onChange={(e) => set("name", e.target.value)}
        hint="e.g. ExxonMobil, BNI, Telkomsel"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Bucket"
          required
          options={bucketOptions()}
          value={values.status}
          onChange={(e) => set("status", e.target.value)}
          hint="Primary · Assist · Akamai · Inactive"
        />
        <Select
          label="Priority"
          required
          options={priorityOptions()}
          value={values.priority}
          onChange={(e) => set("priority", e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Stage (free-text note)"
          value={values.stage ?? ""}
          onChange={(e) => set("stage", e.target.value)}
          hint="Optional human note, e.g. 'PoC ramp-up week 2'."
        />
        <Select
          label="Engagement stage"
          options={stageOptions()}
          value={values.stageKey ?? "ENGAGEMENT"}
          onChange={(e) => set("stageKey", e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="BD / account owner"
          value={values.bdOwner ?? ""}
          onChange={(e) => set("bdOwner", e.target.value)}
        />
        <Input
          label="Revenue estimate"
          value={values.revenueEstimate ?? ""}
          onChange={(e) => set("revenueEstimate", e.target.value)}
          hint="Free-form, e.g. ~$350K/yr or TBD."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="First engagement"
          type="date"
          value={values.firstEngagementOn ?? ""}
          onChange={(e) => set("firstEngagementOn", e.target.value)}
          hint="Calendar date of first contact."
        />
        <Input
          label="Signed on"
          type="date"
          value={values.signedOn ?? ""}
          onChange={(e) => set("signedOn", e.target.value)}
          hint="Date the contract / SoW was signed."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="Region"
          value={values.region ?? ""}
          onChange={(e) => set("region", e.target.value)}
          hint="e.g. ID, SG, MY"
        />
        <Input
          label="Industry"
          value={values.industry ?? ""}
          onChange={(e) => set("industry", e.target.value)}
        />
        <Input
          label="Account value"
          value={values.accountValue ?? ""}
          onChange={(e) => set("accountValue", e.target.value)}
          hint="e.g. ~$350/month"
        />
      </div>
      <Textarea
        label="Summary"
        value={values.summary ?? ""}
        onChange={(e) => set("summary", e.target.value)}
        hint="One-line summary shown on dashboard cards."
      />
      <Textarea
        label="Notes"
        value={values.notes ?? ""}
        onChange={(e) => set("notes", e.target.value)}
        hint="Free-form notes / markdown."
        rows={6}
      />
      <Input
        label="Tags"
        value={values.tags ?? ""}
        onChange={(e) => set("tags", e.target.value)}
        hint="Comma-separated, e.g. banking, migration, waf"
      />

      {error ? (
        <div role="alert" className="text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "Saving..." : mode === "edit" ? "Save changes" : "Create client"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
