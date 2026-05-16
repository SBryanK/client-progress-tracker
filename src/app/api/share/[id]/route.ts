import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/roles";
import { apiError, notFound } from "@/lib/api";

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
    if (!existing) throw notFound("Share link not found");
    await prisma.shareLink.update({ where: { id }, data: { revoked: true } });
    return new Response(null, { status: 204 });
  } catch (err) {
    return apiError(err);
  }
}
