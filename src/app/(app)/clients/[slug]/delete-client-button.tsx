"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DeleteClientButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm("Delete this client and all its weekly updates / activities? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert(b?.error ?? `Delete failed (${res.status})`);
        setBusy(false);
        return;
      }
      router.push("/clients");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <Button variant="destructive" size="sm" onClick={onClick} disabled={busy}>
      {busy ? "Deleting..." : "Delete"}
    </Button>
  );
}
