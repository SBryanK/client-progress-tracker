#!/usr/bin/env sh
set -eu

# ─────────────────────────────────────────────────────────────────────────────
# Runtime entrypoint
# ─────────────────────────────────────────────────────────────────────────────
# Responsibilities, in order:
#   1.  Make sure the SQLite schema matches prisma/schema.prisma (db push)
#   2.  Idempotently seed the OWNER account (sbryank by default)
#   3.  Idempotently reconcile the 33-client roster across the four buckets
#       (PRIMARY / ASSIST / AKAMAI / INACTIVE)
#   4.  Hand off to the Next.js server (passed in as $@)
#
# Steps 2 and 3 are *additive* — they create-if-missing and update-if-stale,
# never delete. That means the app is never empty on first boot, and an
# accidental volume reset auto-heals on the next container start.
# ─────────────────────────────────────────────────────────────────────────────

# Runtime DB lives on the mounted volume so it survives container rebuilds.
export DATABASE_URL="${DATABASE_URL:-file:/app/data/app.db}"

echo "[entrypoint] DATABASE_URL=$DATABASE_URL"

echo "[entrypoint] (1/3) prisma db push — sync schema..."
# --skip-generate: client is already generated in the image.
# --accept-data-loss: only ever drops *columns* SQLite can't migrate; row data
#                     is preserved. Safe for the additive schema we ship.
npx --no-install prisma db push --accept-data-loss --skip-generate

echo "[entrypoint] (2/3) Seeding OWNER account (idempotent)..."
# seed.ts uses prisma.user.upsert so re-running is a no-op when the user exists.
# A failure here MUST stop the boot — running the app with no owner is useless.
npx --no-install tsx prisma/seed.ts

echo "[entrypoint] (3/3) Reconciling client roster (idempotent)..."
# migrate-buckets-to-roster.ts is fully idempotent — it only writes when a
# row's status differs from the canonical bucket, and creates rows that don't
# yet exist. A failure here should NOT stop the app from starting (the app is
# still usable; we just log the error so it's visible in container logs).
if ! npx --no-install tsx scripts/migrate-buckets-to-roster.ts; then
  echo "[entrypoint] WARN: roster reconciliation failed — continuing anyway." >&2
fi

echo "[entrypoint] Bootstrap complete. Starting server: $*"
exec "$@"

