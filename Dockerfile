# syntax=docker/dockerfile:1

# A single image that runs the Aegis server and its web UI side by side:
#   docker build -t aegis .
# The server is the only public entry point (port 3000) and proxies pages to the Next.js UI,
# which listens on loopback inside the container.

# Pinned by digest for reproducible builds; Dependabot keeps tag and digest up to date.
FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS node

FROM node AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# ---------------------------------------------------------------------------
# Dependencies and shared contracts
# ---------------------------------------------------------------------------
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/

FROM manifests AS deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS packages
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY packages/db packages/db
RUN pnpm --filter @aegis/contracts --filter @aegis/db build

# ---------------------------------------------------------------------------
# Server and web UI builds
# ---------------------------------------------------------------------------
FROM packages AS server-build
COPY apps/server apps/server
RUN pnpm --filter @aegis/server build

FROM manifests AS server-prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter "@aegis/server..."

FROM packages AS web-build
COPY apps/web apps/web
RUN pnpm --filter @aegis/web build

# ---------------------------------------------------------------------------
# Runtime image (applies the database migrations from packages/db on startup)
# ---------------------------------------------------------------------------
FROM node AS aegis
# tini runs as PID 1: it forwards signals to the entrypoint and reaps orphaned processes.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY --from=server-prod-deps --chown=node:node /repo/node_modules ./server/node_modules
COPY --from=server-prod-deps --chown=node:node /repo/packages/contracts/node_modules ./server/packages/contracts/node_modules
COPY --from=server-prod-deps --chown=node:node /repo/packages/db/node_modules ./server/packages/db/node_modules
COPY --from=server-prod-deps --chown=node:node /repo/apps/server/node_modules ./server/apps/server/node_modules
COPY --from=packages --chown=node:node /repo/packages/contracts/package.json ./server/packages/contracts/package.json
COPY --from=packages --chown=node:node /repo/packages/contracts/dist ./server/packages/contracts/dist
COPY --from=packages --chown=node:node /repo/packages/db/package.json ./server/packages/db/package.json
COPY --from=packages --chown=node:node /repo/packages/db/dist ./server/packages/db/dist
COPY --from=packages --chown=node:node /repo/packages/db/migrations ./server/packages/db/migrations
COPY --from=server-build --chown=node:node /repo/apps/server/package.json ./server/apps/server/package.json
COPY --from=server-build --chown=node:node /repo/apps/server/dist ./server/apps/server/dist

COPY --from=web-build --chown=node:node /repo/apps/web/.next/standalone ./web
COPY --from=web-build --chown=node:node /repo/apps/web/.next/static ./web/apps/web/.next/static
COPY --from=web-build --chown=node:node /repo/apps/web/public ./web/apps/web/public

COPY --chown=node:node docker/entrypoint.mjs ./entrypoint.mjs

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "/app/entrypoint.mjs"]
