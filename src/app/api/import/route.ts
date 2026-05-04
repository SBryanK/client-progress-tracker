import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/roles";
import { getOwnerIds, requirePrimaryOwnerId } from "@/lib/public";
import { apiError } from "@/lib/api";
import { parseDocx } from "@/lib/import-docx";
import { parseXlsx } from "@/lib/import-xlsx";
import { formatWeekRange } from "@/lib/week";
import { slugify } from "@/lib/utils";

// Cap upload size at 10 MB.
const MAX = 10 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const session = await requireOwner();
    // All imported records anchor to the primary owner so the data set stays
    // single-tenant regardless of which owner email did the upload. Existing
    // records owned by ANY configured OWNER email are treated as duplicates.
    const primaryOwnerId = await requirePrimaryOwnerId();
    const ownerIds = await getOwnerIds();
    const ownerFilter = ownerIds.length
      ? { in: ownerIds }
      : { in: ["__none__"] };
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (file.size > MAX) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
    }

    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const lower = file.name.toLowerCase();

    let importedClients = 0;
    let importedUpdates = 0;
    let importedActivities = 0;
    let format: "docx" | "xlsx" = "docx";
    let parserNotes: string[] = [];

    if (lower.endsWith(".docx")) {
      format = "docx";
      const parsed = await parseDocx(buffer);
      parserNotes = parsed.notes;

      // 1. Upsert clients
      const clientIdByName = new Map<string, string>();
      for (const c of parsed.clients) {
        const existing = await prisma.client.findFirst({
          where: { ownerId: ownerFilter, name: c.name },
        });
        if (existing) {
          clientIdByName.set(c.name, existing.id);
          continue;
        }
        const slug = await ensureUniqueSlug(c.slug);
        const created = await prisma.client.create({
          data: {
            ownerId: primaryOwnerId,
            name: c.name,
            slug,
            status: c.status,
            priority: "MEDIUM",
            isNewLead: c.isNewLead,
            summary: c.summary ?? null,
          },
        });
        clientIdByName.set(c.name, created.id);
        importedClients += 1;
      }

      // 2. Weekly updates — group bullets by (client, weekStart)
      const wkMap = new Map<string, { clientId: string; weekStart: Date; weekLabel: string; bullets: string[] }>();
      for (const u of parsed.weeklyUpdates) {
        const cid = clientIdByName.get(u.clientName);
        if (!cid) continue;
        const key = `${cid}|${u.weekStart.toISOString()}`;
        const entry = wkMap.get(key);
        if (entry) {
          entry.bullets.push(...u.bullets);
        } else {
          wkMap.set(key, {
            clientId: cid,
            weekStart: u.weekStart,
            weekLabel: u.weekLabel || formatWeekRange(u.weekStart),
            bullets: u.bullets.slice(),
          });
        }
      }
      for (const wk of wkMap.values()) {
        await prisma.weeklyUpdate.upsert({
          where: {
            clientId_weekStart: { clientId: wk.clientId, weekStart: wk.weekStart },
          },
          update: {
            weekLabel: wk.weekLabel,
            bullets: wk.bullets.map((b) => `• ${b}`).join("\n"),
          },
          create: {
            clientId: wk.clientId,
            authorId: session.user.id,
            weekStart: wk.weekStart,
            weekLabel: wk.weekLabel,
            bullets: wk.bullets.map((b) => `• ${b}`).join("\n"),
          },
        });
        importedUpdates += 1;
      }

      // 3. Activities
      for (const a of parsed.activities) {
        const cid = clientIdByName.get(a.clientName);
        if (!cid) continue;
        await prisma.clientActivity.create({
          data: {
            clientId: cid,
            authorId: session.user.id,
            kind: a.kind,
            body: a.body,
          },
        });
        importedActivities += 1;
      }
    } else if (lower.endsWith(".xlsx")) {
      format = "xlsx";
      const parsed = parseXlsx(buffer);
      const clientIdByName = new Map<string, string>();
      for (const c of parsed.clients) {
        const existing = await prisma.client.findFirst({
          where: { ownerId: ownerFilter, name: c.name },
        });
        if (existing) {
          clientIdByName.set(c.name, existing.id);
          continue;
        }
        const slug = await ensureUniqueSlug(c.slug);
        const created = await prisma.client.create({
          data: {
            ownerId: primaryOwnerId,
            name: c.name,
            slug,
            status: c.status,
            priority: "MEDIUM",
            isNewLead: c.isNewLead,
          },
        });
        clientIdByName.set(c.name, created.id);
        importedClients += 1;
      }
      for (const u of parsed.weeklyUpdates) {
        const cid = clientIdByName.get(u.clientName);
        if (!cid) continue;
        await prisma.weeklyUpdate.upsert({
          where: {
            clientId_weekStart: { clientId: cid, weekStart: u.weekStart },
          },
          update: {
            weekLabel: u.weekLabel || formatWeekRange(u.weekStart),
            bullets: u.bullets,
            highlights: u.highlights ?? null,
            blockers: u.blockers ?? null,
            nextAction: u.nextAction ?? null,
            status: u.status ?? null,
          },
          create: {
            clientId: cid,
            authorId: session.user.id,
            weekStart: u.weekStart,
            weekLabel: u.weekLabel || formatWeekRange(u.weekStart),
            bullets: u.bullets,
            highlights: u.highlights ?? null,
            blockers: u.blockers ?? null,
            nextAction: u.nextAction ?? null,
            status: u.status ?? null,
          },
        });
        importedUpdates += 1;
      }
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use .docx or .xlsx." },
        { status: 400 },
      );
    }

    await prisma.importBatch.create({
      data: {
        userId: session.user.id,
        filename: file.name,
        format,
        totalItems: importedClients + importedUpdates + importedActivities,
        importedClients,
        importedUpdates,
        importedActivities,
        notes: parserNotes.join("\n") || null,
      },
    });

    return NextResponse.json({
      importedClients,
      importedUpdates,
      importedActivities,
      notes: parserNotes.join("\n") || undefined,
    });
  } catch (err) {
    return apiError(err);
  }
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let s = base || slugify("client");
  let i = 2;
  while (await prisma.client.findUnique({ where: { slug: s } })) {
    s = `${base}-${i++}`;
  }
  return s;
}
