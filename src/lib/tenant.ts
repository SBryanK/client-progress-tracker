// Single-tenant data access helper.
//
// Although we allow multiple OWNER email addresses to sign in (e.g. personal
// account + work account for the same human), all client data belongs to
// "the primary owner" — the first email listed in OWNER_EMAILS.  This keeps
// the tracker single-tenant: every reader and every editor sees the same
// dataset.  When a second owner email signs in and adds a client, it is
// written against the primary owner's id, not their own.
//
// Anonymous public visitors also read the primary owner's data.
//
// If the DB has not been seeded yet, `getPrimaryOwnerId()` returns null and
// callers treat that as "empty tracker".

import { prisma } from "@/lib/prisma";

function primaryOwnerEmail(): string {
  const raw =
    process.env.OWNER_EMAILS ??
    process.env.OWNER_EMAIL ??
    "bryan@local.test";
  const first = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)[0];
  return first ?? "bryan@local.test";
}

let cachedId: string | null = null;
let cachedAt = 0;
const TTL_MS = 30_000;

/**
 * Returns the user id of the primary owner (first OWNER_EMAILS entry), or
 * null if the DB has not been seeded yet.  Cached for 30 s to avoid a DB
 * hit on every page render.
 */
export async function getPrimaryOwnerId(): Promise<string | null> {
  const now = Date.now();
  if (cachedId && now - cachedAt < TTL_MS) return cachedId;
  const email = primaryOwnerEmail();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return null;
  cachedId = user.id;
  cachedAt = now;
  return cachedId;
}

/**
 * Throwing variant for routes that need a tenant id or should 500.
 */
export async function requirePrimaryOwnerId(): Promise<string> {
  const id = await getPrimaryOwnerId();
  if (!id) {
    throw new Error(
      "Tracker has not been seeded yet. Run `npm run db:seed` to create the owner account.",
    );
  }
  return id;
}
