# Deploy to Vercel + Vercel Postgres + EdgeOne CDN (production runbook)

Target architecture:

```
User → client-tracker.sbryank.com  (Hostinger DNS: CNAME)
         │
         ▼
      EdgeOne (CDN + WAF)
         │ origin pull (HTTPS, Host=client-tracker.sbryank.com)
         ▼
      <project>.vercel.app  (Next.js 15 on Vercel, region: sin1)
         │  Prisma Client
         ▼
      Vercel Postgres  (persistent, Neon-backed, auto-provisioned)
```

Why Vercel Postgres?

- **1-click** from the Vercel dashboard — no separate account.
- **Auto-injects** `POSTGRES_PRISMA_URL` (pooled) and `POSTGRES_URL_NON_POOLING`
  (direct) into every deployment environment. Our `prisma/schema.prisma`
  already reads both.
- **Persistent** — survives redeploys, preview branches, rollbacks.
- Free hobby tier is enough for this workload.

---

## 0. Prerequisites

- GitHub account: `github.com/SBryanK` ✅
- Vercel account (sign up with GitHub — 30 s)
- Hostinger account for DNS of `sbryank.com` ✅
- Tencent Cloud EdgeOne Enterprise plan ✅

---

## 1. Rotate leaked secrets (DO THIS FIRST)

The Anthropic key that was pasted in earlier chat messages must be treated as
compromised. Rotate it now at https://console.anthropic.com/settings/keys →
disable the old key, issue a new one.

Generate a fresh `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Keep both values handy — you'll paste them into Vercel in step 4.

---

## 2. Push code to GitHub

The remote is already wired to `https://github.com/SBryanK/client-progress-tracker.git`.
From the project directory:

```bash
cd /data/workspace/client-progress-tracker

# Sanity-check that .env is ignored
git status --short | grep -E "^\\?\\? .env$" && echo "STOP: .env is tracked" || echo "OK: .env is ignored"

# First push (you'll be prompted for a GitHub Personal Access Token)
git push -u origin main
```

Create the PAT at https://github.com/settings/tokens (scope: `repo`). If the
repo doesn't exist yet, create it at https://github.com/new with name
`client-progress-tracker`, **Private** or **Public** (your call), do NOT
initialize with README/license/.gitignore — we already have them.

---

## 3. Import to Vercel

1. Go to https://vercel.com/new
2. **Import Git Repository** → pick `SBryanK/client-progress-tracker`
3. Framework preset: **Next.js** (auto-detected)
4. Root directory: `./`
5. **DO NOT click Deploy yet** — first we provision the database (step 4).
6. If Vercel forces a first build without DB, cancel it — we'll redeploy after
   wiring the DB.

---

## 4. Provision Vercel Postgres (1-click, 60 seconds)

1. After the project is imported, open it in the Vercel dashboard.
2. Top nav → **Storage** → **Create Database** → **Postgres** → **Continue**.
3. Name: `client-progress-tracker-db`. Region: **Singapore (sin1)** (closest
   to your users and to the Next.js runtime region).
4. Click **Create & Continue** → **Connect Project** → select
   `client-progress-tracker` → tick **Production**, **Preview**, **Development**
   → **Connect**.

Vercel now auto-injects into the project (visible under
**Settings → Environment Variables**):

- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`               ← Prisma Client reads this at runtime
- `POSTGRES_URL_NON_POOLING`          ← `prisma db push` reads this at build
- `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`

You don't need to touch any of these.

---

## 5. Add the rest of the environment variables

Project → **Settings** → **Environment Variables** → add:

| Key                           | Value                                                           | Environments          |
|-------------------------------|-----------------------------------------------------------------|-----------------------|
| `AUTH_SECRET`                 | output of `openssl rand -base64 32`                              | Prod + Preview + Dev  |
| `AUTH_TRUST_HOST`             | `true`                                                           | Prod + Preview + Dev  |
| `AUTH_URL`                    | `https://client-tracker.sbryank.com`                             | Production            |
| `AUTH_URL`                    | leave blank or set to the preview URL                            | Preview (optional)    |
| `NEXT_PUBLIC_APP_URL`         | `https://client-tracker.sbryank.com`                             | Prod + Preview + Dev  |
| `OWNER_EMAILS`                | `santasila.bryan@gmail.com,9santasilabryan9@gmail.com`           | Prod + Preview + Dev  |
| `OWNER_PASSWORD`              | strong password (change from the local dev one)                  | Prod + Preview + Dev  |
| `OWNER_NAME`                  | `Bryan`                                                          | Prod + Preview + Dev  |
| `NEXT_PUBLIC_SITE_OWNER_NAME` | `Bryan`                                                          | Prod + Preview + Dev  |
| `NEXT_PUBLIC_SITE_TAGLINE`    | `Weekly client progress — read-only public view.`                | Prod + Preview + Dev  |
| `ANTHROPIC_API_KEY`           | your **new** Anthropic key (the old one was leaked)              | Prod + Preview + Dev  |

Do NOT add `DATABASE_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`
manually — those are owned by the Vercel Postgres integration.

---

## 6. Deploy

Project → **Deployments** → **Redeploy** the latest commit (or push a dummy
commit). The build runs:

```
npm install
prisma generate                    ← via "postinstall"
prisma db push --accept-data-loss  ← creates tables in Vercel Postgres
next build
```

Build takes ~2-3 min. When done, open
`https://client-progress-tracker-<hash>.vercel.app` and confirm the landing
page loads.

---

## 7. Seed the owner account (first run)

Pull the production env down and run the seed once:

```bash
cd /data/workspace/client-progress-tracker

# One-time: install Vercel CLI and login
npm i -g vercel
vercel login
vercel link                         # pick SBryanK/client-progress-tracker

# Pull production env (creates .env.production.local — git-ignored)
vercel env pull .env.production.local --environment=production

# Seed using those real creds
set -a; source .env.production.local; set +a
npx tsx prisma/seed.ts

# Clean up
rm .env.production.local
```

This creates the owner user(s) listed in `OWNER_EMAILS` with
`OWNER_PASSWORD` hashed.

---

## 8. Custom domain + EdgeOne CDN

### 8a. Add the domain in Vercel

1. Project → **Settings** → **Domains** → add `client-tracker.sbryank.com`.
2. Vercel will suggest DNS records. You have two routing options:
   - **Direct (no EdgeOne)**: CNAME `client-tracker` → `cname.vercel-dns.com`.
   - **Through EdgeOne (what you want)**: keep DNS at Hostinger pointing at
     EdgeOne; EdgeOne pulls from Vercel.
3. For the EdgeOne path, still add the domain in Vercel so it issues a TLS
   cert and accepts traffic for that Host header. Vercel may show
   "Invalid Configuration" until traffic actually flows — that's OK; it
   validates automatically on the first real request.

### 8b. EdgeOne configuration

1. Console → EdgeOne → **Add Site** (CNAME access mode if keeping DNS at
   Hostinger): `sbryank.com`.
2. **Domain services** → **Add domain** → `client-tracker.sbryank.com`.
3. **Origin configuration**:
   - Origin type: **Origin domain**
   - Origin address: `<your-vercel-subdomain>.vercel.app`
   - Origin protocol: **HTTPS** (443)
   - **Host header**: `client-tracker.sbryank.com` (CRITICAL — Vercel routes
     by Host header; must match the domain you added in Vercel)
   - Follow 3xx: on
4. **HTTPS**: enable EdgeOne-issued free cert for `client-tracker.sbryank.com`;
   force HTTPS redirect on; HTTP/2 + HTTP/3 on.
5. **Caching rules** (this app is mostly dynamic — be conservative):
   - `/_next/static/*` → cache 1 year (immutable, content-hashed)
   - `/images/*`, `/favicon.ico`, `/icon.svg` → cache 7 days
   - Default → **no-cache** (weekly updates, auth, share links must be fresh)
   - Bypass cache when cookies `authjs.session-token` or
     `next-auth.session-token` are present
6. **Compression**: Brotli + Gzip on.
7. **WAF**: enable the Basic protection ruleset.
8. Copy the CNAME target EdgeOne shows, e.g.
   `client-tracker.sbryank.com.cdn.dnsv1.com`.

### 8c. Hostinger DNS

DNS zone for `sbryank.com`:

| Type  | Name             | Value                                         | TTL  |
|-------|------------------|-----------------------------------------------|------|
| CNAME | `client-tracker` | `client-tracker.sbryank.com.cdn.dnsv1.com`    | 300  |

Wait 5-30 min for propagation.

---

## 9. Smoke test

```bash
# Should return HTTP/2 200 with TencentEdgeOne server header
curl -I https://client-tracker.sbryank.com

# Hit origin directly — also 200
curl -I https://<your-project>.vercel.app

# DNS check
dig +short client-tracker.sbryank.com
```

Browser: open https://client-tracker.sbryank.com → landing page loads, then
sign in with an `OWNER_EMAILS` address + `OWNER_PASSWORD`.

---

## 10. Ongoing workflow

- **Any push to `main`** → Vercel auto-builds & deploys. `prisma db push` runs
  against Vercel Postgres, so schema changes are applied automatically.
- **Preview branches** get their own URL + the same Postgres DB (be careful:
  previews write to production data). For isolated previews, create a second
  Vercel Postgres store and scope it to Preview only.
- **Env var changes** → Vercel → Redeploy (they're only read at build/runtime
  start).
- **Rollback** → Vercel → Deployments → select a previous one → Promote.
- **EdgeOne cache purge** is only needed for hard static changes; Next.js
  content-hashes all `/_next/static/*` so code pushes don't require a purge.

---

## 11. Troubleshooting

| Symptom                                                  | Likely cause / fix                                                                                                |
|----------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| Vercel build fails on `prisma db push`                   | Vercel Postgres not connected to the project. Re-check Storage → Project link. Confirm `POSTGRES_URL_NON_POOLING` env var is present. |
| 500 on `/api/auth/*`                                     | `AUTH_SECRET` missing or `AUTH_URL` ≠ the host the browser is using. Set `AUTH_TRUST_HOST=true`.                  |
| Auth redirects to `*.vercel.app` instead of custom domain| `AUTH_URL` must be `https://client-tracker.sbryank.com` for Production.                                            |
| EdgeOne returns 404 / Vercel 404 page                    | Origin Host header not set to the custom domain. Fix in EdgeOne origin config.                                     |
| "prepared statement already exists" on Postgres          | Something is using the non-pooling URL at runtime. Confirm `schema.prisma` has `url = env("POSTGRES_PRISMA_URL")`. |
| "Too many connections"                                   | Same — make sure runtime uses the pooled URL (`POSTGRES_PRISMA_URL`).                                              |
| Static assets stale in the browser                       | EdgeOne → Caching → Purge by prefix `/_next/static/` after a deploy if old hashes appear.                          |
| Preview deploys mutate production data                   | Create a second Vercel Postgres store, connect only to Preview/Development, leave the first one only on Production. |
