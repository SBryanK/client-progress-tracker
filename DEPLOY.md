# Deployment Runbook

This document is the **single source of truth** for keeping the Client Progress
Tracker running on the AnyDev preview at
`http://sbryankusno-any6.devcloud.woa.com/`.

The app is supervised by **systemd** as the unit
`client-progress-tracker.service`, listening directly on port 80 of the CVM.
The AnyDev smart gateway routes the bare hostname to that port, so no
`PORT-` prefix is needed.

The VM does not have `docker compose` installed; the `Dockerfile` and
`docker-compose.yml` in the repo remain valid for any host that does (e.g.
Vercel CI, a future container migration, or local dev), but they are NOT
the production deployment path on this VM.

---

## TL;DR — Redeploy after pushing to `main`

```bash
cd /data/workspace/client-progress-tracker
git pull origin main
npm ci --no-audit --no-fund      # only when package-lock.json changed
npm run build                    # safe; never touches the DB
sudo systemctl restart client-progress-tracker
sudo journalctl -u client-progress-tracker -n 30 --no-pager
```

The systemd `ExecStartPre` chain runs three idempotent steps before the
server starts:

1. `prisma db push --skip-generate --accept-data-loss` — sync schema
2. `tsx prisma/seed.ts` — upsert the OWNER user (`sbryank`)
3. `tsx scripts/migrate-buckets-to-roster.ts` — reconcile the 33-client roster

After that, `next start -H 0.0.0.0 -p 80` takes over. The service is
`Restart=always` with rate-limited backoff, so a crash auto-recovers within
~5 s.

---

## Architecture (one paragraph)

`/etc/systemd/system/client-progress-tracker.service` (a copy of
`deploy/client-progress-tracker.service` in the repo) defines the unit. It
runs as `root` (required to bind port 80) with `NoNewPrivileges`,
`ProtectSystem=full`, `ProtectHome=read-only`, and
`ReadWritePaths=/data/workspace/client-progress-tracker`. The SQLite DB
lives at the **absolute** path
`/data/workspace/client-progress-tracker/data/app.db` so Prisma's CLI and
runtime client always agree on which file to open. The unit reads
`.env` via `EnvironmentFile` for `AUTH_SECRET`, `OWNER_USERNAMES`,
`OWNER_PASSWORD`, `ANTHROPIC_API_KEY`, etc. `NEXT_PUBLIC_*` values are
inlined into the client bundle by `next build`, so changing the public URL
requires a rebuild.

---

## First-time install (or rebuilding from scratch on a new VM)

```bash
cd /data/workspace/client-progress-tracker

# 1. Install deps and build
npm ci --no-audit --no-fund
npm run build

# 2. Bootstrap the DB (idempotent — safe to re-run)
npm run db:bootstrap

# 3. Install the systemd unit
sudo cp deploy/client-progress-tracker.service \
        /etc/systemd/system/client-progress-tracker.service
sudo systemctl daemon-reload
sudo systemctl enable --now client-progress-tracker
sudo systemctl status client-progress-tracker --no-pager
```

`enable --now` does both `enable` (boot persistence) and `start` (run now)
in one command.

---

## Recovery: "I pushed code but the site shows broken JS / CSS"

This is the classic stale-server symptom. A `next-server` is running with
in-memory references to chunk hashes that a newer `npm run build` has
overwritten. Browser fetches `/_next/static/chunks/main-app-OLD_HASH.js`
→ server returns `HTTP 400`.

```bash
cd /data/workspace/client-progress-tracker
git pull origin main
npm run build                            # rebuild .next/
sudo systemctl restart client-progress-tracker
```

Verify: every chunk in the served HTML should resolve `200 OK`:

```bash
curl -s http://localhost/ -o /tmp/p.html -w "HTTP=%{http_code}\n"
for p in $(grep -oE '/_next/static/(css|chunks)/[^"]+\.(css|js)' /tmp/p.html | sort -u); do
  printf "%-70s %s\n" "$p" "$(curl -sI "http://localhost$p" | head -1)"
done
```

If any path 4xx's, the running server is still on the old build — restart
the service again. If `restart` doesn't help, run `sudo systemctl status
client-progress-tracker` to check whether `ExecStartPre` failed (e.g. a
Prisma migration error) and read `journalctl -u client-progress-tracker
-n 100` for the cause.

---

## Recovery: "I see the app but there are zero clients"

Almost always one of:

1. `OWNER_USERNAMES` in `.env` doesn't match the seeded user (compare
   `sqlite3 data/app.db "select username from User"` with the env value).
2. The SQLite file at `data/app.db` is empty (0 bytes) or missing.

Fix:

```bash
cd /data/workspace/client-progress-tracker
npm run db:bootstrap            # idempotent: upsert OWNER + 33 clients
sudo systemctl restart client-progress-tracker
curl -s http://localhost/api/clients | head -c 200    # should NOT be {"clients":[]}
```

`db:bootstrap` runs `prisma/seed.ts` (OWNER upsert) and
`scripts/migrate-buckets-to-roster.ts` (33-client upsert) in sequence. Both
are idempotent — running them on a healthy DB is a no-op.

`getOwnerIds()` in `src/lib/public.ts` accepts BOTH `OWNER_USERNAMES`
(preferred, matches the username login model) and `OWNER_EMAILS` (legacy).
If you accidentally remove both from `.env`, every public read returns
empty.

---

## Owner credentials (sign-in)

- **Username**: `sbryank`
- **Password**: `#1203Sadhu` (configurable via `OWNER_PASSWORD` in `.env`)

Sign-in uses **username**, not email. The "Sign in" button is in the
top-right of every page, or use the "I'm Bryan" card on the first-visit
identity gate at `/welcome`.

---

## Build scripts cheat-sheet

| Script | What it does | Safe for local? |
| --- | --- | --- |
| `npm run dev` | Hot-reload dev server on `:3000` | ✅ |
| `npm run build` | `prisma generate` + `next build` (NO DB push) | ✅ |
| `npm run build:image` | Same, plus `prisma db push` against a throwaway DB | ⚠️ Docker-only |
| `npm run start` | Serve the built `.next/` on `:3000` | ✅ |
| `npm run db:bootstrap` | Upsert OWNER + reconcile 33-client roster | ✅ |
| `npm run db:seed` | Upsert OWNER only | ✅ |
| `npm run db:migrate-buckets` | Reconcile client roster only | ✅ |

`npm run build` is intentionally **non-destructive** — it never touches the
DB. You can run it on the host while the systemd service is up; the
service won't notice until you `systemctl restart` it.

---

## Why `npm run build` is now safe

Pre-2026-05-17 the `build` script ran `prisma db push --accept-data-loss`
against the dev DB AND rewrote `.next/`. If a server was still running it
would lose track of its chunk hashes → broken JS/CSS until restart. That
was the original "JS/CSS gak ke-load" bug.

Now: `build` is non-destructive, and `build:image` (Docker-only) is the
sole script that mutates a DB during build, and it operates on
`/tmp/build.db` (throwaway). So neither development DB nor production DB
can be touched by a build.

---

## File layout reference

```
/data/workspace/client-progress-tracker/
├── data/app.db                  # SQLite — the production DB (absolute path)
├── .env                         # secrets + OWNER_USERNAMES + DATABASE_URL
├── deploy/
│   └── client-progress-tracker.service   # systemd unit (source of truth)
├── docker/
│   └── entrypoint.sh            # only used when running via docker compose
├── prisma/
│   ├── schema.prisma            # SQLite schema
│   ├── schema.postgres.prisma   # Vercel/Postgres variant
│   └── seed.ts                  # OWNER upsert
└── scripts/
    └── migrate-buckets-to-roster.ts   # 33-client upsert (idempotent)
```

`/etc/systemd/system/client-progress-tracker.service` is a copy of the
file in `deploy/`; `daemon-reload` after editing the file in the repo,
or `cp` the new version over and `daemon-reload` again.
