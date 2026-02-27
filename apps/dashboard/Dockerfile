# ============================================================
# Stage 1: Install dependencies
# ============================================================
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace config files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy ALL workspace package.json files (pnpm --frozen-lockfile requires full workspace)
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/sdk-web/package.json packages/sdk-web/package.json

# Install production + dev dependencies (needed for build)
RUN pnpm install --frozen-lockfile

# ============================================================
# Stage 2: Build
# ============================================================
FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy installed dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./

# Copy source code for shared packages (must build first as dependency)
COPY packages/shared/ packages/shared/

# Build shared packages
RUN pnpm --filter @support-helper/shared build

# Copy Dashboard source code
COPY apps/dashboard/ apps/dashboard/

# Build args for Next.js environment variables baked at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_RELEASE
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV NEXT_PUBLIC_SENTRY_RELEASE=${NEXT_PUBLIC_SENTRY_RELEASE}
ENV NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY}
ENV NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST}

# Ensure public directory exists (may be empty)
RUN mkdir -p apps/dashboard/public

# Enable standalone output for Docker builds
ENV NEXT_OUTPUT_STANDALONE=true

# Build the Dashboard (standalone mode enabled via env var)
RUN pnpm --filter @support-helper/dashboard build

# ============================================================
# Stage 3: Production
# ============================================================
FROM node:20-alpine AS production

# Add dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
WORKDIR /app

# Copy Next.js standalone output
COPY --from=build /app/apps/dashboard/.next/standalone ./
COPY --from=build /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=build /app/apps/dashboard/public ./apps/dashboard/public

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

USER appuser

EXPOSE 3000

# Next.js standalone server runs from the app directory
CMD ["dumb-init", "node", "apps/dashboard/server.js"]
