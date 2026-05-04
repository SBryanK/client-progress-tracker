"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";

/**
 * AI Assistant panel rendered on the landing page.
 *
 * Sends the user's question to `/api/ai/summarize`, which in turn calls
 * Anthropic Claude Haiku 4.5 with a redacted snapshot of every weekly
 * update on record. The assistant is free-form — the user can ask
 * "summarize last month for BNI" or "what's on-going right now" and the
 * backend will give the model the relevant slice of the database.
 */
export function AIAssistant() {
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function ask(prompt: string) {
    const question = prompt.trim();
    if (!question || loading) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: question }]);
    setQ("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const data: { answer: string } = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.answer || "(empty response)" },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    "Summarize this week across every client",
    "Which clients are idle right now?",
    "Give me a manager-friendly report for the last month",
    "What moved on BNI lately?",
  ];

  return (
    <section
      aria-label="AI assistant"
      className="rounded-3xl border border-border bg-bg shadow-sm animate-fade-up overflow-hidden"
    >
      <header className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-border bg-bg-subtle/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-soft text-accent">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">AI Assistant</p>
            <p className="text-xs text-fg-subtle truncate">
              Summarize, filter, and question weekly log
            </p>
          </div>
        </div>
      </header>

      <div className="px-5 sm:px-6 py-5 max-h-[420px] overflow-y-auto scroll-contain">
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fg-muted">
              Ask anything about your client log — for example:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="press text-xs rounded-full border border-border bg-bg hover:bg-accent-soft hover:border-accent/40 text-fg-muted hover:text-accent px-3 py-1.5 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <li
                key={i}
                className={
                  m.role === "user"
                    ? "self-end max-w-[85%]"
                    : "self-start max-w-[92%]"
                }
              >
                <div
                  className={
                    m.role === "user"
                      ? "rounded-2xl rounded-br-sm bg-accent text-accent-fg px-4 py-2.5 text-sm whitespace-pre-wrap"
                      : "rounded-2xl rounded-bl-sm bg-bg-subtle border border-border text-fg px-4 py-3 text-sm prose-entry"
                  }
                >
                  {m.content}
                </div>
              </li>
            ))}
            {loading ? (
              <li className="self-start">
                <div className="rounded-2xl rounded-bl-sm bg-bg-subtle border border-border text-fg-muted px-4 py-3 text-sm inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Thinking…
                </div>
              </li>
            ) : null}
            <div ref={endRef} />
          </ul>
        )}
      </div>

      {error ? (
        <p
          role="alert"
          className="mx-5 sm:mx-6 mb-3 text-xs text-danger rounded-md bg-danger/10 border border-danger/30 px-3 py-2"
        >
          {error}
        </p>
      ) : null}

      <form
        className="flex items-center gap-2 px-5 sm:px-6 py-4 border-t border-border"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about any client or week…"
          disabled={loading}
          className="flex-1 h-11 rounded-xl bg-bg-subtle border border-border px-4 text-sm placeholder:text-fg-subtle focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !q.trim()}
          aria-label="Send"
          className="press inline-flex h-11 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg shadow-sm hover:bg-accent-hover hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
          <span className="hidden sm:inline">Ask</span>
        </button>
      </form>
    </section>
  );
}
