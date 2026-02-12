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
COPY apps/web/package.json apps/web/package.json
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
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./

# Copy source code for shared packages (must build first as dependency)
COPY packages/shared/ packages/shared/
COPY packages/database/ packages/database/

# Build shared packages
RUN pnpm --filter @support-helper/shared build
RUN pnpm --filter @support-helper/database build

# Copy API source code and Prisma schema
COPY apps/api/ apps/api/

# Generate Prisma client (this creates node_modules/.prisma and node_modules/@prisma)
RUN cd apps/api && npx prisma generate

# Build the API
RUN pnpm --filter @support-helper/api build

# ============================================================
# Stage 3: Production
# ============================================================
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Add dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy ALL workspace package.json files (pnpm --frozen-lockfile requires full workspace)
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/sdk-web/package.json packages/sdk-web/package.json

# Copy Prisma schema BEFORE install (needed for @prisma/client postinstall)
COPY --from=build /app/apps/api/prisma apps/api/prisma

# Install production dependencies only (this will run prisma generate via postinstall)
RUN pnpm install --frozen-lockfile --prod

# Copy built shared packages
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/database/dist packages/database/dist

# Copy API build output
COPY --from=build /app/apps/api/dist apps/api/dist

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

USER appuser

EXPOSE 3001

CMD ["dumb-init", "node", "apps/api/dist/src/main.js"]
