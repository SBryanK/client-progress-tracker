import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/roles";
import { getOwnerIds } from "@/lib/public";
import { CLIENT_STATUSES, CLIENT_PRIORITIES } from "@/lib/status";
import { apiError } from "@/lib/api";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  priority: z.enum(CLIENT_PRIORITIES).optional(),
  stage: z.string().max(200).optional().nullable(),
  bdOwner: z.string().max(200).optional().nullable(),
  region: z.string().max(50).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  accountValue: z.string().max(100).optional().nullable(),
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
  if (!c) throw new Error("Client not found");
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
    const updated = await prisma.client.update({
      where: { id },
      data: body,
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
