# syntax=docker/dockerfile:1.7
#
# Production image for the Weekly Client Progress Tracker
# (Next.js 15 + Prisma + SQLite).
#
# Layout:
#   deps    -> install node_modules (cache-friendly)
#   builder -> next build
#   runner  -> minimal runtime image (non-root, tini as PID 1)
#
# Container listens on port 3000; docker-compose maps host:80 -> container:3000
# so the bare AnyDev hostname (https://sbryankusno-any6.devcloud.woa.com) works.

# ─── 1. deps stage ──────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Prisma's `postinstall` hook needs openssl to generate the query engine.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Only copy the files that affect `npm ci` so this layer is cached aggressively.
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Tencent CVMs often have flaky access to registry.npmjs.org; fall back to the
# Tencent mirror if the default registry is slow. Override at build time with
# --build-arg NPM_REGISTRY=https://registry.npmjs.org
ARG NPM_REGISTRY=https://mirrors.cloud.tencent.com/npm/
RUN npm config set registry "$NPM_REGISTRY" \
    && npm ci --no-audit --no-fund


# ─── 2. build stage ─────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json

# Full source tree (respecting .dockerignore)
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
# Override with --build-arg or docker-compose `build.args` if the host changes.
ARG NEXT_PUBLIC_APP_URL="https://sbryankusno-any6.devcloud.woa.com"
ARG NEXT_PUBLIC_SITE_OWNER_NAME="Bryan"
ARG NEXT_PUBLIC_SITE_TAGLINE="Weekly client progress — read-only public view."
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_SITE_OWNER_NAME=${NEXT_PUBLIC_SITE_OWNER_NAME}
ENV NEXT_PUBLIC_SITE_TAGLINE=${NEXT_PUBLIC_SITE_TAGLINE}

ENV NEXT_TELEMETRY_DISABLED=1
# Build-time DB is a throwaway file; the real DB lives on a volume at runtime.
ENV DATABASE_URL="file:/tmp/build.db"

# package.json's build script runs: prisma generate + prisma db push + next build.
# We point DATABASE_URL at /tmp so the throwaway DB never ends up in the image.
RUN npm run build \
    && rm -f /tmp/build.db /tmp/build.db-journal


# ─── 3. runtime stage ───────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# openssl: Prisma query engine, tini: proper PID 1 / signal handling.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd  --system --uid 1001 --gid nodejs nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy only what's needed at runtime. (We don't use `output: 'standalone'`
# because next.config.js doesn't enable it — copying .next + node_modules
# is reliable.)
COPY --from=builder --chown=nextjs:nodejs /app/.next            ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules     ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json     ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js   ./next.config.js
COPY --from=builder --chown=nextjs:nodejs /app/prisma           ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts          ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json    ./tsconfig.json
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh \
    && mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# SQLite DB and any other runtime state go here (mounted as a named volume).
VOLUME ["/app/data"]

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "./entrypoint.sh"]
CMD ["npm", "run", "start"]
