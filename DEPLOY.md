# Deployment Runbook

This document is the **single source of truth** for keeping the Client Progress
Tracker running smoothly on the AnyDev preview at
`https://sbryankusno-any6.devcloud.woa.com/`. It covers the standard
"redeploy after a code change" flow and the recovery procedure for the
"JS / CSS not loading" symptom we hit on 2026-05-17.

---

## TL;DR — How to redeploy after pushing to `main`

```bash
# From inside the dev container shell (not local machine):
cd /data/workspace/client-progress-tracker
git pull origin main

docker compose down            # stop the running container
docker compose up --build -d   # rebuild image + start fresh container

docker compose logs -f web     # watch the entrypoint bootstrap logs
```

The entrypoint will:

1. Apply the Prisma schema (`prisma db push`)
2. Idempotently seed the OWNER user (`sbryank`)
3. Idempotently reconcile the 33-client roster across the four buckets
4. Start the Next.js production server

The DB lives on the named docker volume `app-data` and **survives** rebuilds.
Steps 2 and 3 are upserts — they never delete data.

---

## Architecture (one paragraph)

The container listens on port 3000. `docker-compose.yml` maps host port 80 →
container port 3000 so AnyDev's smart gateway routes the bare hostname
(`sbryankusno-any6.devcloud.woa.com`) directly to it without needing a `PORT-`
prefix. SQLite lives at `/app/data/app.db` inside the container, which is
backed by the named docker volume `app-data` so the data survives image
rebuilds. NextAuth secrets and the Anthropic API key come from `.env` via
`env_file` (never baked into the image). `NEXT_PUBLIC_*` variables are
inlined at build time, so changing the public hostname requires a rebuild.

---

## Recovery: "I pushed code but the site shows broken JS / CSS"

This happens when a stale `next-server` is still running with in-memory
references to chunk hashes that the latest build has overwritten. Browser
fetches `/_next/static/chunks/main-app-OLD_HASH.js` → server returns
`HTTP 400`. The fix is to restart the container so Next.js rehydrates from
the fresh `.next/` build.

```bash
cd /data/workspace/client-progress-tracker
docker compose restart web                # quick: same image, fresh process
# or, if the image itself is stale:
docker compose down && docker compose up --build -d
```

Verify the fix:

```bash
# Should return HTTP 200 and HTML referencing _next chunks that all 200.
curl -sSI http://localhost/ | head -3
curl -s   http://localhost/ | grep -oE '/_next/static/chunks/[^"]+\.js' | head -3 | \
  while read p; do printf "%s -> " "$p"; curl -sI "http://localhost$p" | head -1; done
```

Every chunk should return `HTTP/1.1 200 OK`. If any return `400` or `404`,
the container is still running an old build — `docker compose down` and
`up --build` again.

---

## Recovery: "I see the app but there are zero clients"

The DB volume was reset (e.g. `docker volume rm client-progress-tracker_app-data`).
The entrypoint reseeds the OWNER user automatically, but to repopulate the
33-client roster manually:

```bash
docker compose exec web npm run db:bootstrap
```

`db:bootstrap` runs `prisma/seed.ts` (OWNER upsert) and
`scripts/migrate-buckets-to-roster.ts` (33-client upsert) in sequence. Both
are idempotent.

If you're running natively (no docker) and need to recover dev data:

```bash
npm run db:bootstrap
```

---

## Owner credentials (sign-in)

- **Username**: `sbryank`
- **Password**: `#1203Sadhu` (configurable via `OWNER_PASSWORD` in `.env`)

Sign-in uses **username**, not email. The "Sign in" button is in the
top-right of every page; or use the "I'm Bryan" card on the first-visit
identity gate.

---

## Build scripts cheat-sheet

| Script | What it does | Safe for local? |
| --- | --- | --- |
| `npm run dev` | Hot-reload dev server on `:3000` | ✅ |
| `npm run build` | `prisma generate` + `next build` (no DB push) | ✅ |
| `npm run build:image` | Same plus `prisma db push` against a throwaway DB | ⚠️ Docker-only |
| `npm run start` | Serve the built `.next/` on `:3000` | ✅ |
| `npm run db:bootstrap` | Seed OWNER + reconcile 33-client roster (idempotent) | ✅ |
| `npm run db:seed` | Seed OWNER only | ✅ |
| `npm run db:migrate-buckets` | Reconcile client roster only | ✅ |

`npm run build` is intentionally **non-destructive** — it never touches the
DB. The `build:image` variant is the one the Dockerfile invokes against the
throwaway `/tmp/build.db`, so the production volume is never affected by
image builds.

---

## Why we don't run `npm run build` on the host while the container is up

Old behaviour (pre 2026-05-17): `package.json`'s `build` ran
`prisma db push --accept-data-loss` against `prisma/dev.db`, **and** rewrote
`.next/`. If a `next-server` was still running, its chunk hashes would
diverge from disk → broken JS/CSS until the server restarted. That's the
exact bug from the May 17 incident.

New behaviour: `build` no longer touches the DB, and the Dockerfile uses
`build:image` which operates on a throwaway DB inside the build context.
You can run `npm run build` on the host any time — it won't break the
running container, and it won't wipe data.
