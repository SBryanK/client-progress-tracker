// Single-tenant data access helper.
//
// Although we allow multiple OWNER identities to sign in (e.g. personal
// account + work account for the same human), all client data belongs to
// "the primary owner" — the first identity listed in OWNER_USERNAMES (or,
// for legacy installs, OWNER_EMAILS). This keeps the tracker single-tenant:
// every reader and every editor sees the same dataset. When a second owner
// signs in and adds a client, it is written against the primary owner's id,
// not their own.
//
// Anonymous public visitors also read the primary owner's data.
//
// If the DB has not been seeded yet, `getPrimaryOwnerId()` returns null and
// callers treat that as "empty tracker".

import { prisma } from "@/lib/prisma";

function configuredOwnerUsernames(): string[] {
  const raw =
    process.env.OWNER_USERNAMES ?? process.env.OWNER_USERNAME ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function configuredOwnerEmails(): string[] {
  const raw = process.env.OWNER_EMAILS ?? process.env.OWNER_EMAIL ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

let cachedId: string | null = null;
let cachedAt = 0;
const TTL_MS = 30_000;

/**
 * Returns the user id of the primary owner, or null if the DB has not been
 * seeded yet. Lookup order: first matching OWNER_USERNAMES entry, then first
 * matching OWNER_EMAILS entry. Cached for 30 s to avoid a DB hit on every
 * page render.
 */
export async function getPrimaryOwnerId(): Promise<string | null> {
  const now = Date.now();
  if (cachedId && now - cachedAt < TTL_MS) return cachedId;

  for (const username of configuredOwnerUsernames()) {
    const u = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (u) {
      cachedId = u.id;
      cachedAt = now;
      return cachedId;
    }
  }
  for (const email of configuredOwnerEmails()) {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (u) {
      cachedId = u.id;
      cachedAt = now;
      return cachedId;
    }
  }
  return null;
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
