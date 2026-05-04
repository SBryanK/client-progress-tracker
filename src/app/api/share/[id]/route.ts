import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner, AuthError } from "@/lib/roles";

/**
 * /api/share/[id] — revoke (fail-closed, never hard-delete so old URLs
 * return a clear "revoked" response instead of silently becoming new links).
 */
type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const session = await requireOwner();
    const { id } = await ctx.params;
    const existing = await prisma.shareLink.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.shareLink.update({ where: { id }, data: { revoked: true } });
    return new Response(null, { status: 204 });
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
