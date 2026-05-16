import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/roles";
import { getOwnerIds } from "@/lib/public";
import { apiError, notFound } from "@/lib/api";

const createSchema = z.object({
  kind: z.enum(["ACTIVITY", "ISSUE_SUPPORT", "PROGRESS"]),
  body: z.string().min(1).max(10000),
  occurredOn: z.string().nullable().optional(),
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
    const occurredOn = body.occurredOn ? new Date(body.occurredOn) : null;

    const activity = await prisma.clientActivity.create({
      data: {
        clientId: client.id,
        authorId: session.user.id,
        kind: body.kind,
        body: body.body.trim(),
        occurredOn,
      },
    });
    return NextResponse.json(activity, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
