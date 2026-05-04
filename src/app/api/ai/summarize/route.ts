import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerIds } from "@/lib/public";
import { format } from "date-fns";
import { te } from "date-fns/locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/summarize
 *
 * Body: { question: string }
 * Returns: { answer: string }
 *
 * Sends the full weekly-update corpus (trimmed to a safe cap) to Claude
 * Haiku 4.5 along with the user's question. No personal / owner data is
 * included — only client name, week, bullets, highlights, blockers,
 * next-action.
 */
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const question = (body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }
  if (question.length > 2000) {
    return NextResponse.json(
      { error: "Question is too long (2000 char max)" },
      { status: 400 },
    );
  }

  const ownerIds = await getOwnerIds();
  const ownerFilter = ownerIds.length
    ? { in: ownerIds }
    : { in: ["__none__"] };

  // Pull the last ~500 updates ordered newest-first. More than enough for
  // a typical "last month" or "per client" slice without blowing the
  // context window.
  const updates = await prisma.weeklyUpdate.findMany({
    where: { client: { ownerId: ownerFilter, archived: false } },
    include: { client: { select: { name: true, status: true } } },
    orderBy: { weekStart: "desc" },
    take: 500,
  });

  const corpus = updates
    .map((u) => {
      const wk = format(u.weekStart, "yyyy-MM-dd");
      const label = u.weekLabel || wk;
      const parts = [
        `### ${u.client.name} — ${label} (status: ${u.status ?? u.client.status})`,
        u.bullets?.trim(),
        u.highlights ? `Highlights: ${u.highlights.trim()}` : "",
        u.blockers ? `Blockers: ${u.blockers.trim()}` : "",
        u.nextAction ? `Next: ${u.nextAction.trim()}` : "",
      ].filter(Boolean);
      return parts.join("\n");
    })
    .join("\n\n");

  const systemPrompt = [
    "You are a concise assistant embedded in Bryan's Client Progress Tracker.",
    "Bryan is an EdgeOne Solutions Architect intern at Tencent Cloud.",
    "You have access to every weekly client progress log below.",
    "Answer his questions accurately using ONLY the provided log — if a",
    "fact isn't in the log, say you don't have that information.",
    "Prefer short, well-structured answers with headings and bullets.",
    "When the user asks for a summary, group by client or by week as",
    "appropriate, highlight blockers and next actions, and keep the",
    "tone professional and manager-friendly.",
  ].join(" ");

  const userPrompt = [
    `# Weekly client progress log (most recent first)`,
    corpus || "(no weekly updates yet)",
    ``,
    `# Question`,
    question,
  ].join("\n\n");

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Anthropic API ${resp.status}: ${errText.slice(0, 300) || resp.statusText}`,
        },
        { status: 502 },
      );
    }

    const data = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const answer =
      data.content
        ?.filter((c) => c.type === "text" && c.text)
        .map((c) => c.text)
        .join("\n")
        .trim() ?? "";

    return NextResponse.json({ answer });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to reach the Anthropic API",
      },
      { status: 502 },
    );
  }
}
