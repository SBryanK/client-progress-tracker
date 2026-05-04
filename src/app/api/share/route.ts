import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireOwner, AuthError } from "@/lib/roles";

/**
 * /api/share — owner-only CRUD for ShareLink rows.
 *
 * GET    → list every share link owned by the caller
 * POST   → create a new share link (returns { link }) with a random 24-byte token
 *
 * Individual links (revoke) are handled at /api/share/[id].
 */
const createSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(100),
  clientSlug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  statusFilter: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

export async function GET() {
  try {
    const session = await requireOwner();
    const links = await prisma.shareLink.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ links });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.code === "UNAUTHENTICATED" ? 401 : 403 },
      );
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireOwner();
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;

    // Resolve clientSlug → clientId (scoped to owner's clients only).
    let clientId: string | null = null;
    if (data.clientSlug) {
      const c = await prisma.client.findFirst({
        where: { slug: data.clientSlug, ownerId: session.user.id },
        select: { id: true },
      });
      if (!c) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      clientId = c.id;
    }

    const token = randomBytes(24).toString("hex");
    const link = await prisma.shareLink.create({
      data: {
        userId: session.user.id,
        token,
        label: data.label,
        fromDate: data.fromDate ? new Date(data.fromDate) : null,
        toDate: data.toDate ? new Date(data.toDate + "T23:59:59Z") : null,
        clientId,
        statusFilter: data.statusFilter ?? null,
        expiresAt: data.expiresInDays
          ? new Date(Date.now() + data.expiresInDays * 86_400_000)
          : null,
      },
    });
    return NextResponse.json({ link }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.code === "UNAUTHENTICATED" ? 401 : 403 },
      );
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
