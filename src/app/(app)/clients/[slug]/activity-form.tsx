"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export function ActivityForm({
  clientId,
  kind,
}: {
  clientId: string;
  kind: "ACTIVITY" | "ISSUE_SUPPORT" | "PROGRESS";
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [occurredOn, setOccurredOn] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/activities`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          body,
          occurredOn: occurredOn || null,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? `Failed (${res.status})`);
      }
      setBody("");
      setOccurredOn("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2" aria-busy={saving}>
      <Textarea
        label="Add entry"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        rows={2}
      />
      <Input
        label="Date (optional)"
        type="date"
        value={occurredOn}
        onChange={(e) => setOccurredOn(e.target.value)}
      />
      {error ? (
        <div role="alert" className="text-xs text-danger">
          {error}
        </div>
      ) : null}
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Saving..." : "Add"}
      </Button>
    </form>
  );
}
