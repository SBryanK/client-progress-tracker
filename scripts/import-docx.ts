// CLI importer — reads a .docx file and upserts clients/weekly updates/activities
// into the DB, anchored to the primary owner (first entry in OWNER_EMAILS).
//
//   pnpm import:docx /path/to/tracker.docx
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { parseDocx } from "../src/lib/import-docx";
import { formatWeekRange } from "../src/lib/week";
import { slugify } from "../src/lib/utils";

const prisma = new PrismaClient();

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: pnpm import:docx <file.docx>");
    process.exit(2);
  }
  // Pick the primary owner (first configured OWNER email). Falls back to the
  // legacy single OWNER_EMAIL for backwards-compat.
  const ownerEmails = (process.env.OWNER_EMAILS ?? process.env.OWNER_EMAIL ?? "bryan@local.test")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const ownerEmail = ownerEmails[0] ?? "bryan@local.test";
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    console.error(`Owner user not found: ${ownerEmail} — run 'pnpm db:seed' first.`);
    process.exit(1);
  }

  const buf = await readFile(filePath);
  const parsed = await parseDocx(buf);
  console.log(
    `[import] parsed: ${parsed.clients.length} clients, ${parsed.weeklyUpdates.length} weekly updates, ${parsed.activities.length} activities`,
  );

  const clientIdByName = new Map<string, string>();
  for (const c of parsed.clients) {
    const existing = await prisma.client.findFirst({
      where: { ownerId: owner.id, name: c.name },
    });
    if (existing) {
      clientIdByName.set(c.name, existing.id);
      continue;
    }
    let slug = c.slug || slugify(c.name);
    let i = 2;
    while (await prisma.client.findUnique({ where: { slug } })) {
      slug = `${c.slug}-${i++}`;
    }
    const created = await prisma.client.create({
      data: {
        ownerId: owner.id,
        name: c.name,
        slug,
        status: c.status,
        priority: "MEDIUM",
        isNewLead: c.isNewLead,
      },
    });
    clientIdByName.set(c.name, created.id);
  }

  const wkMap = new Map<string, { clientId: string; weekStart: Date; weekLabel: string; bullets: string[] }>();
  for (const u of parsed.weeklyUpdates) {
    const cid = clientIdByName.get(u.clientName);
    if (!cid) continue;
    const key = `${cid}|${u.weekStart.toISOString()}`;
    const entry = wkMap.get(key);
    if (entry) entry.bullets.push(...u.bullets);
    else
      wkMap.set(key, {
        clientId: cid,
        weekStart: u.weekStart,
        weekLabel: u.weekLabel || formatWeekRange(u.weekStart),
        bullets: u.bullets.slice(),
      });
  }
  for (const wk of wkMap.values()) {
    await prisma.weeklyUpdate.upsert({
      where: { clientId_weekStart: { clientId: wk.clientId, weekStart: wk.weekStart } },
      update: {
        weekLabel: wk.weekLabel,
        bullets: wk.bullets.map((b) => `• ${b}`).join("\n"),
      },
      create: {
        clientId: wk.clientId,
        authorId: owner.id,
        weekStart: wk.weekStart,
        weekLabel: wk.weekLabel,
        bullets: wk.bullets.map((b) => `• ${b}`).join("\n"),
      },
    });
  }

  for (const a of parsed.activities) {
    const cid = clientIdByName.get(a.clientName);
    if (!cid) continue;
    await prisma.clientActivity.create({
      data: {
        clientId: cid,
        authorId: owner.id,
        kind: a.kind,
        body: a.body,
      },
    });
  }

  console.log("[import] done.");
}

main()
  .catch((err) => {
    console.error("[import] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
