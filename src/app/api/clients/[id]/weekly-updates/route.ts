import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/roles";
import { getOwnerIds } from "@/lib/public";
import { parseWeekInput, formatWeekRange } from "@/lib/week";
import { apiError, notFound, badRequest } from "@/lib/api";

const createSchema = z.object({
  weekStart: z.string().min(1), // YYYY-MM-DD or YYYY-Wxx
  weekLabel: z.string().max(120).optional().nullable(),
  bullets: z.string().min(1).max(20000),
  highlights: z.string().max(2000).optional().nullable(),
  blockers: z.string().max(2000).optional().nullable(),
  nextAction: z.string().max(2000).optional().nullable(),
  status: z.string().max(50).optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireOwner();
    const { id } = await params;
    const ownerIds = await getOwnerIds();
    const client = await prisma.client.findFirst({
      where: {
        id,
        ownerId: ownerIds.length ? { in: ownerIds } : { in: ["__none__"] },
      },
    });
    if (!client) throw notFound("Client not found");

    const body = createSchema.parse(await req.json());
    const weekStart = parseWeekInput(body.weekStart);
    if (!weekStart) throw badRequest("Invalid weekStart");

    const label = body.weekLabel?.trim() || formatWeekRange(weekStart);

    const update = await prisma.weeklyUpdate.upsert({
      where: {
        clientId_weekStart: {
          clientId: client.id,
          weekStart,
        },
      },
      update: {
        weekLabel: label,
        bullets: body.bullets.trim(),
        highlights: body.highlights ?? null,
        blockers: body.blockers ?? null,
        nextAction: body.nextAction ?? null,
        status: body.status ?? client.status,
      },
      create: {
        clientId: client.id,
        authorId: session.user.id,
        weekStart,
        weekLabel: label,
        bullets: body.bullets.trim(),
        highlights: body.highlights ?? null,
        blockers: body.blockers ?? null,
        nextAction: body.nextAction ?? null,
        status: body.status ?? client.status,
      },
    });
    return NextResponse.json(update, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
