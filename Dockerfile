# syntax=docker/dockerfile:1

# Aegis as a single Node.js process: the backend serves the API, the OpenID Connect protocol and
# the frontend, which is built into static files.
#   docker build -t aegis .

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
# Dependencies and shared packages
# ---------------------------------------------------------------------------
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/email/package.json packages/email/
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/

FROM manifests AS deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS packages
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY packages/db packages/db
COPY packages/email packages/email
RUN pnpm --filter @aegis/contracts --filter @aegis/db --filter @aegis/email build

# ---------------------------------------------------------------------------
# Backend and frontend builds
# ---------------------------------------------------------------------------
FROM packages AS backend-build
COPY apps/backend apps/backend
RUN pnpm --filter @aegis/backend build

FROM packages AS frontend-build
COPY apps/frontend apps/frontend
RUN pnpm --filter @aegis/frontend build

# Production dependencies of the backend only; the frontend is plain files at runtime.
FROM manifests AS backend-prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter "@aegis/backend..."

# ---------------------------------------------------------------------------
# Runtime image: the workspace layout, reduced to what runs. Database migrations from
# packages/db are applied on startup.
# ---------------------------------------------------------------------------
FROM node AS aegis
ENV NODE_ENV=production
WORKDIR /app

COPY --from=backend-prod-deps /repo/node_modules ./node_modules
COPY --from=backend-prod-deps /repo/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=backend-prod-deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=backend-prod-deps /repo/packages/email/node_modules ./packages/email/node_modules
COPY --from=backend-prod-deps /repo/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=packages /repo/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=packages /repo/packages/contracts/dist ./packages/contracts/dist
COPY --from=packages /repo/packages/db/package.json ./packages/db/package.json
COPY --from=packages /repo/packages/db/dist ./packages/db/dist
COPY --from=packages /repo/packages/db/migrations ./packages/db/migrations
COPY --from=packages /repo/packages/email/package.json ./packages/email/package.json
COPY --from=packages /repo/packages/email/dist ./packages/email/dist
COPY --from=backend-build /repo/apps/backend/package.json ./apps/backend/package.json
COPY --from=backend-build /repo/apps/backend/dist ./apps/backend/dist
COPY --from=frontend-build /repo/apps/frontend/out ./apps/frontend/out

# The files belong to root and are only readable for the unprivileged user Aegis runs as.
USER node
WORKDIR /app/apps/backend
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# Node.js runs as PID 1 and handles SIGTERM itself: it stops accepting requests, finishes the open
# ones, closes the database pool and exits. It starts no child processes that would need reaping.
CMD ["node", "dist/index.js"]
