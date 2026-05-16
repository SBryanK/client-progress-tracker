import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/roles";
import { getOwnerIds } from "@/lib/public";
import { CLIENT_STATUSES, CLIENT_PRIORITIES } from "@/lib/status";
import { CLIENT_STAGES } from "@/lib/stage";
import { apiError, notFound } from "@/lib/api";

// Optional `YYYY-MM-DD` string → Date | null. Same shape as in POST.
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  priority: z.enum(CLIENT_PRIORITIES).optional(),
  stage: z.string().max(200).optional().nullable(),
  stageKey: z.enum(CLIENT_STAGES).optional(),
  bdOwner: z.string().max(200).optional().nullable(),
  region: z.string().max(50).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  accountValue: z.string().max(100).optional().nullable(),
  revenueEstimate: z.string().max(100).optional().nullable(),
  firstEngagementOn: dateOnly,
  signedOn: dateOnly,
  summary: z.string().max(500).optional().nullable(),
  notes: z.string().max(20000).optional().nullable(),
  tags: z.string().max(500).optional().nullable(),
  isNewLead: z.boolean().optional(),
});

async function ensureOwned(id: string) {
  const ownerIds = await getOwnerIds();
  const c = await prisma.client.findFirst({
    where: {
      id,
      ownerId: ownerIds.length ? { in: ownerIds } : { in: ["__none__"] },
    },
  });
  if (!c) throw notFound("Client not found");
  return c;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOwner();
    const { id } = await params;
    await ensureOwned(id);
    const body = patchSchema.parse(await req.json());
    // Convert the two `YYYY-MM-DD` strings into Date objects (or null)
    // so Prisma stores them as DateTime; we re-pack into a typed payload
    // rather than spreading `body` so TS narrows the shape correctly.
    const { firstEngagementOn, signedOn, ...rest } = body;
    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...rest,
        ...(firstEngagementOn !== undefined
          ? {
              firstEngagementOn: firstEngagementOn
                ? new Date(firstEngagementOn + "T00:00:00.000Z")
                : null,
            }
          : {}),
        ...(signedOn !== undefined
          ? {
              signedOn: signedOn
                ? new Date(signedOn + "T00:00:00.000Z")
                : null,
            }
          : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOwner();
    const { id } = await params;
    await ensureOwned(id);
    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
