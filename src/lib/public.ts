// Public-read helpers.
//
// The site is single-tenant in intent — only the OWNER_EMAILS addresses can
// sign in and edit. However, we want read queries to return data written by
// ANY of those owner accounts, so that switching between your personal and
// work email does not split the dataset.
//
// `getOwnerIds()` returns the DB user ids of every email in OWNER_EMAILS,
// deduped and cached briefly. Anonymous public visitors use this too; the
// landing page, client list, client detail, and weekly timeline all filter
// on `ownerId IN getOwnerIds()`.

import { prisma } from "@/lib/prisma";

function configuredOwnerEmails(): string[] {
  const raw =
    process.env.OWNER_EMAILS ??
    process.env.OWNER_EMAIL ??
    "bryan@local.test";
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

let cached: { ids: string[]; at: number } | null = null;
const TTL_MS = 30_000;

/**
 * Returns the Prisma user ids for every configured OWNER email that actually
 * exists in the DB. Empty array = DB not seeded yet.
 */
export async function getOwnerIds(): Promise<string[]> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.ids;
  const emails = configuredOwnerEmails();
  if (emails.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  cached = { ids, at: now };
  return ids;
}

/**
 * Returns the "primary" owner id (first OWNER_EMAILS entry that exists in
 * the DB). Used when we need to WRITE — we pick a single tenant to anchor
 * the record against.
 */
export async function getPrimaryOwnerId(): Promise<string | null> {
  const emails = configuredOwnerEmails();
  for (const email of emails) {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (u) return u.id;
  }
  return null;
}

/**
 * Throwing variant for write paths. Ensures a tenant exists before mutating.
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
