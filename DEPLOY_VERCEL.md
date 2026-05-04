# Deploy to Vercel + EdgeOne CDN (production runbook)

Target architecture:

```
User → client-tracker.sbryank.com  (Hostinger DNS)
         │ CNAME
         ▼
      EdgeOne (CDN + WAF)
         │ origin pull
         ▼
      <project>.vercel.app  (Next.js on Vercel, region: sin1)
         │
         ▼
      Postgres (Neon / Supabase / Vercel Postgres)
```

---

## 0. Prerequisites

- GitHub account: `github.com/SBryanK`
- Vercel account (sign up with GitHub for 1-click import)
- Postgres database (pick one):
  - **Neon** (recommended, free tier is generous): https://neon.tech
  - **Supabase**: https://supabase.com
  - **Vercel Postgres** (one-click from Vercel dashboard)
- Hostinger account for DNS of `sbryank.com`
- Tencent Cloud EdgeOne Enterprise plan (already have)

---

## 1. Rotate leaked secrets (DO THIS FIRST)

Your local `.env` contains real secrets. Even though `.gitignore` excludes it,
the ANTHROPIC key has been pasted in chat. **Rotate it now** at
https://console.anthropic.com/settings/keys — disable the old key, issue a new
one. You'll paste the new key into Vercel env vars in step 5.

Also generate a fresh `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Keep this value — you'll paste it into Vercel.

---

## 2. Push code to GitHub

From the project directory:

```bash
cd /data/workspace/client-progress-tracker

# One-time git identity (replace with your info)
git config --global user.name  "Bryan Santasila"
git config --global user.email "santasila.bryan@gmail.com"

# Init + initial commit
git init -b main
git add .
git status                        # ← verify .env is NOT in the list
git commit -m "chore: initial commit — Weekly Client Progress Tracker"

# Create repo on github.com/SBryanK first (UI or `gh` CLI), then:
git remote add origin git@github.com:SBryanK/client-progress-tracker.git
# or HTTPS:
# git remote add origin https://github.com/SBryanK/client-progress-tracker.git

git push -u origin main
```

If using HTTPS auth, GitHub will prompt for a **Personal Access Token** (not
password). Create one at https://github.com/settings/tokens with `repo` scope.

---

## 3. Provision Postgres (Neon example, 3 minutes)

1. Sign in to https://console.neon.tech with GitHub.
2. **Create project** → name: `client-progress-tracker`, region: `ap-southeast-1 (Singapore)`.
3. After creation, go to **Connection Details** → copy two URLs:
   - **Pooled** connection → this is your `DATABASE_URL`
   - **Direct** connection → this is your `DIRECT_URL` (optional but recommended)

They look like:
```
postgresql://user:pwd@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
postgresql://user:pwd@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

---

## 4. Import to Vercel

1. Go to https://vercel.com/new
2. **Import Git Repository** → pick `SBryanK/client-progress-tracker`
3. Framework: **Next.js** (auto-detected)
4. Root directory: `./`
5. **DO NOT click Deploy yet** — first add env vars (next step).

---

## 5. Environment variables on Vercel

In the Vercel import screen, under **Environment Variables**, add:

| Key                           | Value                                                           |
|-------------------------------|-----------------------------------------------------------------|
| `DATABASE_URL`                | Neon pooled URL from step 3                                      |
| `DIRECT_URL`                  | Neon direct URL (optional)                                       |
| `AUTH_SECRET`                 | output of `openssl rand -base64 32`                              |
| `AUTH_TRUST_HOST`             | `true`                                                           |
| `AUTH_URL`                    | `https://client-tracker.sbryank.com`                             |
| `NEXT_PUBLIC_APP_URL`         | `https://client-tracker.sbryank.com`                             |
| `OWNER_EMAILS`                | `santasila.bryan@gmail.com,9santasilabryan9@gmail.com`           |
| `OWNER_PASSWORD`              | strong password (change from the dev one)                        |
| `OWNER_NAME`                  | `Bryan`                                                          |
| `NEXT_PUBLIC_SITE_OWNER_NAME` | `Bryan`                                                          |
| `NEXT_PUBLIC_SITE_TAGLINE`    | `Weekly client progress — read-only public view.`                |
| `ANTHROPIC_API_KEY`           | your **new** Anthropic key (the old one was leaked in chat)      |

Scope: apply to **Production**, **Preview**, **Development** (all checked).

Click **Deploy**. First build takes ~2-3 min. It runs:
```
prisma generate && prisma db push --accept-data-loss --skip-generate && next build
```
which also creates the tables in Neon.

When done you get a URL like `https://client-progress-tracker-xxx.vercel.app`.
Open it, confirm the landing page loads and login works.

---

## 6. Seed the database (first run)

After first deploy, your DB is empty. Run seed remotely:

Option A — from your local machine, pointing to Neon:
```bash
cd /data/workspace/client-progress-tracker
# Temporarily put the Neon DATABASE_URL + OWNER_* vars in a local .env.seed
DATABASE_URL="<neon pooled url>" \
OWNER_EMAILS="santasila.bryan@gmail.com" \
OWNER_PASSWORD="<same as Vercel>" \
OWNER_NAME="Bryan" \
npx tsx prisma/seed.ts
```

Option B — from Vercel dashboard, add a one-off cron/deploy hook that runs
`npm run db:seed` (not covered here — Option A is simpler).

---

## 7. DNS + custom domain

### 7a. On Vercel
1. Project → **Settings** → **Domains** → add `client-tracker.sbryank.com`.
2. Vercel gives you DNS instructions. You have two routing options:
   - **Direct (no EdgeOne)**: CNAME `client-tracker` → `cname.vercel-dns.com`.
   - **Through EdgeOne (what you want)**: don't point DNS at Vercel directly;
     we'll use EdgeOne as the middleman.

For the EdgeOne path, still add the domain in Vercel so Vercel issues a TLS
cert and accepts requests for that Host header. Vercel might complain about
DNS mismatch — that's OK, it will validate once traffic actually flows from
EdgeOne with the correct Host header.

### 7b. On EdgeOne
1. Console → EdgeOne → **Add Site** → `sbryank.com` (NS mode) or
   **CNAME access** mode if you want to keep DNS at Hostinger.
2. **Domain service** → **Add domain** → `client-tracker.sbryank.com`.
3. **Origin configuration**:
   - Origin type: **Origin domain**
   - Origin address: `<your-vercel-subdomain>.vercel.app`
   - Origin protocol: **HTTPS** (port 443)
   - **Host header**: `client-tracker.sbryank.com`
     (CRITICAL — Vercel routes by Host header; must match the custom domain
      you added in Vercel)
   - Follow 301/302: on
4. **HTTPS**: let EdgeOne issue a free cert for `client-tracker.sbryank.com`,
   or upload your own. Force HTTPS redirect: on. HTTP/2 + HTTP/3: on.
5. **Caching rules**:
   - `/_next/static/*` → cache 1 year
   - `/images/*`, `/favicon.ico`, `/icon.svg` → cache 7 days
   - Everything else (default) → **no-cache** or very short TTL
     (because this app is dynamic — weekly updates, auth, share links).
   - Bypass cache when cookies `authjs.session-token` or `next-auth.session-token`
     are present.
6. **Compression**: Brotli + Gzip on.
7. **WAF**: enable Basic protection ruleset.
8. EdgeOne shows a **CNAME target** like
   `client-tracker.sbryank.com.cdn.dnsv1.com`. Copy it.

### 7c. On Hostinger
DNS zone for `sbryank.com`:

| Type  | Name             | Value                                         | TTL  |
|-------|------------------|-----------------------------------------------|------|
| CNAME | `client-tracker` | `client-tracker.sbryank.com.cdn.dnsv1.com`    | 300  |

Wait 5-30 min for propagation.

---

## 8. Smoke test

```bash
# Should return HTTP/2 200 with Server: TencentEdgeOne-ish header
curl -I https://client-tracker.sbryank.com

# Hit origin directly — also should be 200
curl -I https://<your-project>.vercel.app

# DNS resolution check
dig +short client-tracker.sbryank.com
```

Browser: open https://client-tracker.sbryank.com — should see the public
landing page. Click **Sign in**, use an `OWNER_EMAILS` address + the
`OWNER_PASSWORD` you set.

---

## 9. Ongoing workflow

Any push to `main` → Vercel auto-deploys. Preview deploys happen for branches
and PRs. EdgeOne keeps pointing at the stable production domain, so no cache
purge is needed for code pushes (only for static asset hash changes, which
Next.js handles with content-hashed filenames automatically).

If you change env vars in Vercel, click **Redeploy** to pick them up.

---

## 10. Troubleshooting

| Symptom                                    | Likely cause / fix                                                                                    |
|--------------------------------------------|-------------------------------------------------------------------------------------------------------|
| Vercel build fails on `prisma db push`     | `DATABASE_URL` wrong/unreachable. Check Neon dashboard, ensure `?sslmode=require` is present.         |
| 500 on `/api/auth/*`                       | `AUTH_SECRET` missing or `AUTH_URL` doesn't match the host. Set `AUTH_TRUST_HOST=true`.               |
| EdgeOne returns 404 / Vercel 404           | Origin Host header not set to the custom domain. Fix in EdgeOne origin config.                        |
| Auth redirects to vercel.app instead of custom domain | `AUTH_URL` should be the public domain (`https://client-tracker.sbryank.com`), not the vercel one. |
| "Too many connections" on Postgres         | Use the **pooled** Neon URL for `DATABASE_URL`, not the direct one.                                   |
| Static assets stale                        | EdgeOne → Cache → purge by prefix `/_next/static/` after a deploy if you see old hashes.              |
