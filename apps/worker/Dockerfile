# ============================================================
# Stage 1: Install dependencies
# ============================================================
FROM node:20-slim AS deps

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
FROM node:20-slim AS build

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy installed dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
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

# Copy API prisma schema (worker references ../api/prisma/schema.prisma)
COPY apps/api/prisma/ apps/api/prisma/

# Copy API source code (worker imports integration providers from API)
COPY apps/api/src/ apps/api/src/
COPY apps/api/tsconfig.json apps/api/tsconfig.json

# Copy Worker source code
COPY apps/worker/ apps/worker/

# Generate Prisma client for worker (uses api's schema)
RUN cd apps/worker && npx prisma generate --schema=../api/prisma/schema.prisma

# Build the Worker
RUN pnpm --filter @support-helper/worker build

# ============================================================
# Stage 3: Production
# ============================================================
FROM node:20-slim AS production

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Install FFmpeg and Tesseract OCR (required for video analysis pipeline)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ffmpeg \
      tesseract-ocr \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

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

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built shared packages
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/database/dist packages/database/dist

# Copy Worker build output
COPY --from=build /app/apps/worker/dist apps/worker/dist

# Copy Prisma schema and generated client
# Note: Client is generated in API node_modules because schema is in apps/api/prisma/
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/node_modules/.prisma apps/api/node_modules/.prisma
COPY --from=build /app/apps/api/node_modules/@prisma apps/api/node_modules/@prisma

# Create non-root user
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/sh appuser

USER appuser

CMD ["dumb-init", "node", "apps/worker/dist/main.js"]
