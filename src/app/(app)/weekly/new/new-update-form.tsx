"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { format } from "date-fns";

type ClientLite = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

/**
 * Streamlined weekly-update composer.
 *
 * Three fields — Client (fuzzy combobox), Week range (start → end), and the
 * summary text. One POST saves a weekly-update record; the page refreshes
 * so the dashboard, timeline, and client detail pick it up immediately.
 */
export function NewUpdateForm({
  clients,
  defaultClientSlug,
  defaultWeekStart,
}: {
  clients: ClientLite[];
  defaultClientSlug: string;
  defaultWeekStart: string;
}) {
  const router = useRouter();
  const [clientSlug, setClientSlug] = useState(defaultClientSlug);
  const [weekStart, setWeekStart] = useState(defaultWeekStart);
  // Default end = +6 days (a full week).
  const [weekEnd, setWeekEnd] = useState(() => {
    const d = new Date(defaultWeekStart + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) return defaultWeekStart;
    return new Date(d.getTime() + 6 * 86400000).toISOString().slice(0, 10);
  });
  const [bullets, setBullets] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clientBySlug = useMemo(
    () => new Map(clients.map((c) => [c.slug, c])),
    [clients],
  );
  const selectedClient = clientBySlug.get(clientSlug) ?? clients[0];

  // Pretty "Apr 27 – May 2" label driven by the chosen range.
  const weekLabel = useMemo(() => {
    if (!weekStart || !weekEnd) return "";
    const a = new Date(weekStart + "T00:00:00Z");
    const b = new Date(weekEnd + "T00:00:00Z");
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";
    return `${format(a, "MMM d")} – ${format(b, "MMM d")}`;
  }, [weekStart, weekEnd]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!selectedClient) throw new Error("Pick a client");
      if (!weekStart || !weekEnd) throw new Error("Pick a week range");
      if (weekStart > weekEnd) {
        throw new Error("The start date must be on or before the end date");
      }
      if (!bullets.trim()) {
        throw new Error("Please write at least one line of progress");
      }

      const res = await fetch(
        `/api/clients/${selectedClient.id}/weekly-updates`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            weekStart,
            weekLabel,
            bullets: bullets.trim(),
            status: selectedClient.status,
          }),
        },
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? `Failed to save (${res.status})`);
      }

      setBullets("");
      setSuccess(`Saved — ${selectedClient.name}, ${weekLabel || weekStart}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} aria-busy={saving} className="grid gap-5">
      <ClientCombobox
        clients={clients}
        value={clientSlug}
        onChange={setClientSlug}
      />

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium text-fg">Week range *</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="From"
            type="date"
            required
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            required
            value={weekEnd}
            onChange={(e) => setWeekEnd(e.target.value)}
          />
        </div>
        {weekLabel ? (
          <p className="text-xs text-fg-subtle">
            Will be logged as{" "}
            <span className="font-medium text-fg">{weekLabel}</span>.
          </p>
        ) : null}
      </fieldset>

      <Textarea
        label="What happened this week *"
        required
        rows={8}
        value={bullets}
        onChange={(e) => setBullets(e.target.value)}
        placeholder={"• Demo'd EdgeOne to the ops team\n• Explained WAF pricing\n• Agreed on next-step POC plan"}
        hint="One bullet per line. Start each line with • or - if you like."
      />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          role="status"
          className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
        >
          {success}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "Saving…" : "Save update"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (selectedClient) router.push(`/clients/${selectedClient.slug}`);
          }}
          disabled={saving}
        >
          Open client page
        </Button>
      </div>
    </form>
  );
}

/* ─── ClientCombobox ────────────────────────────────────────────────────
 *
 * Accessible, keyboard-navigable combobox that lets you type any part of a
 * client's name to filter. Supports:
 *  - Free-text fuzzy search (subsequence + word-start match)
 *  - ↑ ↓ to move, Enter to select, Escape to close
 *  - Click outside to dismiss
 *  - "Create new client" shortcut when the query has no match (jumps to
 *    /clients/new?name=…)
 */
function ClientCombobox({
  clients,
  value,
  onChange,
}: {
  clients: ClientLite[];
  value: string;
  onChange: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);

  const selected = clients.find((c) => c.slug === value);

  // Lightweight fuzzy ranker: exact > startsWith > subsequence.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    const scored: Array<{ c: ClientLite; score: number }> = [];
    for (const c of clients) {
      const name = c.name.toLowerCase();
      let score = -1;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else if (subsequence(q, name)) score = 30;
      if (score >= 0) scored.push({ c, score });
    }
    scored.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
    return scored.map((s) => s.c);
  }, [clients, query]);

  // Clamp highlight whenever the list changes.
  useEffect(() => {
    setHighlight((h) => Math.min(Math.max(0, h), Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (!open) return;
    const el = optionRefs.current[highlight];
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function commit(c: ClientLite) {
    onChange(c.slug);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      const c = filtered[highlight];
      if (c) commit(c);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="grid gap-1.5">
      <label
        htmlFor="client-combobox-input"
        className="text-sm font-medium text-fg"
      >
        Client *
      </label>

      <div ref={wrapRef} className="relative">
        {/* Trigger / display */}
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls="client-combobox-list"
          className="flex w-full items-center justify-between gap-2 h-11 rounded-xl border border-border bg-bg px-3.5 text-left text-sm hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
        >
          <span className={selected ? "truncate text-fg" : "truncate text-fg-subtle"}>
            {selected?.name ?? "Choose a client…"}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {open ? (
          <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-border bg-bg shadow-lg overflow-hidden">
            {/* Search input */}
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 text-fg-subtle" aria-hidden />
              <input
                id="client-combobox-input"
                ref={inputRef}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={open}
                aria-controls="client-combobox-list"
                aria-activedescendant={
                  filtered[highlight]
                    ? `cbx-opt-${filtered[highlight]!.slug}`
                    : undefined
                }
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Type to search — e.g. 'bni', 'exxon', 'bank…'"
                autoComplete="off"
                className="flex-1 h-10 bg-transparent text-sm placeholder:text-fg-subtle focus:outline-none"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="press inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-subtle hover:bg-bg-muted hover:text-fg"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </div>

            {/* Options */}
            <ul
              id="client-combobox-list"
              role="listbox"
              aria-label="Clients"
              className="max-h-64 overflow-y-auto py-1 scroll-contain"
            >
              {filtered.length === 0 ? (
                <li className="px-3.5 py-3 text-sm text-fg-subtle">
                  No clients match &ldquo;{query}&rdquo;.{" "}
                  <a
                    href={`/clients/new?name=${encodeURIComponent(query)}`}
                    className="text-accent hover:underline"
                  >
                    Create new →
                  </a>
                </li>
              ) : (
                filtered.map((c, i) => {
                  const isSel = c.slug === value;
                  const isHi = i === highlight;
                  return (
                    <li
                      key={c.slug}
                      id={`cbx-opt-${c.slug}`}
                      role="option"
                      aria-selected={isSel}
                      tabIndex={-1}
                      ref={(el) => {
                        optionRefs.current[i] = el;
                      }}
                      onMouseEnter={() => setHighlight(i)}
                      onMouseDown={(e) => {
                        // Avoid blurring the input before click registers.
                        e.preventDefault();
                      }}
                      onClick={() => commit(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          commit(c);
                        }
                      }}
                      className={`flex items-center justify-between gap-2 px-3.5 py-2 text-sm cursor-pointer ${
                        isHi ? "bg-accent/10 text-fg" : "text-fg-muted"
                      } ${isSel ? "font-medium text-fg" : ""}`}
                    >
                      <span className="truncate">{c.name}</span>
                      {isSel ? (
                        <Check className="h-3.5 w-3.5 text-accent" aria-hidden />
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>

      {!open && selected ? (
        <p className="text-xs text-fg-subtle">
          Current status:{" "}
          <span className="font-medium text-fg">{selected.status}</span>
        </p>
      ) : null}
    </div>
  );
}

/** Returns true if every character of `q` appears in `text` in order. */
function subsequence(q: string, text: string): boolean {
  let i = 0;
  for (let j = 0; j < text.length && i < q.length; j++) {
    if (text[j] === q[i]) i++;
  }
  return i === q.length;
}
