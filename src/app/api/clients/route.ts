import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/roles";
import { getOwnerIds, requirePrimaryOwnerId } from "@/lib/public";
import { slugify } from "@/lib/utils";
import { CLIENT_STATUSES, CLIENT_PRIORITIES } from "@/lib/status";
import { apiError } from "@/lib/api";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  status: z.enum(CLIENT_STATUSES),
  priority: z.enum(CLIENT_PRIORITIES),
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

export async function GET() {
  try {
    // Public list — anyone can read. Filter by the configured OWNER emails'
    // user ids so the tenant boundary is preserved even without a session.
    const ownerIds = await getOwnerIds();
    const clients = await prisma.client.findMany({
      where: {
        ownerId: ownerIds.length ? { in: ownerIds } : { in: ["__none__"] },
        archived: false,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ clients });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireOwner();
    const primaryOwnerId = await requirePrimaryOwnerId();
    const body = createSchema.parse(await req.json());

    // Ensure slug uniqueness by appending -2, -3, …
    let slug = slugify(body.name);
    let n = 2;
    while (await prisma.client.findUnique({ where: { slug } })) {
      slug = `${slugify(body.name)}-${n++}`;
    }

    const client = await prisma.client.create({
      data: {
        ownerId: primaryOwnerId,
        name: body.name.trim(),
        slug,
        status: body.status,
        priority: body.priority,
        stage: body.stage ?? null,
        bdOwner: body.bdOwner ?? null,
        region: body.region ?? null,
        industry: body.industry ?? null,
        accountValue: body.accountValue ?? null,
        summary: body.summary ?? null,
        notes: body.notes ?? null,
        tags: body.tags ?? null,
        isNewLead: body.isNewLead ?? false,
      },
    });
    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
