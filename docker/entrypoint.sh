#!/usr/bin/env sh
set -eu

# The runtime DB lives in the mounted volume /app/data so it survives
# container rebuilds. Default to that path unless DATABASE_URL was set by
# the compose file or another environment source.
export DATABASE_URL="${DATABASE_URL:-file:/app/data/app.db}"

echo "[entrypoint] DATABASE_URL=$DATABASE_URL"
echo "[entrypoint] Applying prisma schema (db push)..."
# --skip-generate: client is already generated in the image.
# --accept-data-loss: safe for SQLite first-boot on a fresh volume.
npx --no-install prisma db push --accept-data-loss --skip-generate

echo "[entrypoint] Starting server: $*"
exec "$@"
