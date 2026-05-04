"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { format } from "date-fns";

export function WeeklyUpdateForm({
  clientId,
  defaultStatus,
}: {
  clientId: string;
  defaultStatus: string;
}) {
  const router = useRouter();
  const today = new Date();
  const [weekStart, setWeekStart] = useState<string>(
    // snap to most recent Monday
    format(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7)),
      "yyyy-MM-dd",
    ),
  );
  const [weekLabel, setWeekLabel] = useState("");
  const [bullets, setBullets] = useState("");
  const [highlights, setHighlights] = useState("");
  const [blockers, setBlockers] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/weekly-updates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weekStart,
          weekLabel,
          bullets,
          highlights,
          blockers,
          nextAction,
          status: defaultStatus,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Failed (${res.status})`);
      }
      setBullets("");
      setHighlights("");
      setBlockers("");
      setNextAction("");
      setWeekLabel("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3" aria-busy={saving}>
      <Input
        label="Week starting (Mon)"
        type="date"
        required
        value={weekStart}
        onChange={(e) => setWeekStart(e.target.value)}
      />
      <Input
        label="Week label"
        value={weekLabel}
        onChange={(e) => setWeekLabel(e.target.value)}
        hint="e.g. April 6 – April 10 (optional — auto-computed if blank)"
      />
      <Textarea
        label="Bullets"
        required
        value={bullets}
        onChange={(e) => setBullets(e.target.value)}
        hint="One bullet per line. Start each with • or -."
        rows={5}
      />
      <Textarea
        label="Highlights (optional)"
        value={highlights}
        onChange={(e) => setHighlights(e.target.value)}
        hint="Manager-facing one-line summary."
        rows={2}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Textarea
          label="Blockers"
          value={blockers}
          onChange={(e) => setBlockers(e.target.value)}
          rows={2}
        />
        <Textarea
          label="Next action"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          rows={2}
        />
      </div>
      {error ? (
        <div role="alert" className="text-sm text-danger">
          {error}
        </div>
      ) : null}
      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Add update"}
      </Button>
    </form>
  );
}
