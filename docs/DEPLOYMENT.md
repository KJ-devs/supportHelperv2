# Deployment Guide

This guide covers deploying Support Helper to production using Vercel (frontend) and Railway (backend).

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Database Setup](#database-setup)
- [Backend Deployment (Railway)](#backend-deployment-railway)
- [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
- [Environment Variables](#environment-variables)
- [Post-Deployment](#post-deployment)
- [Alternative Platforms](#alternative-platforms)
- [Monitoring](#monitoring)

## Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Production Setup                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐ │
│  │   Vercel     │         │   Railway    │         │   Railway    │ │
│  │  Dashboard   │────────▶│     API      │────────▶│  PostgreSQL  │ │
│  │  (Next.js)   │         │  (NestJS)    │         │              │ │
│  └──────────────┘         └──────────────┘         └──────────────┘ │
│                                  │                                    │
│                           ┌──────┴──────┐                           │
│                           │             │                           │
│                           ▼             ▼                           │
│                    ┌──────────┐  ┌──────────┐                       │
│                    │  Redis   │  │   S3 /   │                       │
│                    │(Upstash) │  │ Cloudflare│                       │
│                    └──────────┘  │   R2     │                       │
│                                  └──────────┘                        │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Services Required

| Service | Provider Options | Purpose |
|---------|-----------------|---------|
| PostgreSQL | Railway, Supabase, Neon | Primary database |
| Redis | Railway, Upstash | Cache & queues |
| Object Storage | S3, Cloudflare R2, MinIO | Video storage |
| API Hosting | Railway, Render, Fly.io | Backend API |
| Frontend | Vercel, Netlify, Cloudflare Pages | Dashboard |

## Prerequisites

- GitHub repository with the project
- Accounts on:
  - [Railway](https://railway.app)
  - [Vercel](https://vercel.com)
  - [Upstash](https://upstash.com) (optional, for Redis)
  - [AWS](https://aws.amazon.com) or [Cloudflare](https://cloudflare.com) (for S3/R2)
- OpenAI API key (for AI features)

## Database Setup

### Railway PostgreSQL

1. **Create a new project** on Railway

2. **Add PostgreSQL service**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Wait for provisioning

3. **Get connection string**
   - Click on the PostgreSQL service
   - Go to "Variables" tab
   - Copy `DATABASE_URL`

4. **Enable required extensions**
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "vector";
   ```

### Alternative: Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings → Database
3. Copy the connection string
4. Enable pgvector extension in SQL editor

## Backend Deployment (Railway)

### Step 1: Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Choose the `apps/api` directory

### Step 2: Configure Build Settings

In Railway project settings:

```
Root Directory: apps/api
Build Command: pnpm install && pnpm build
Start Command: node dist/main
```

### Step 3: Add Environment Variables

Add these variables in Railway:

```env
# Database
DATABASE_URL=postgresql://...

# Redis (use Railway Redis or Upstash)
REDIS_URL=redis://...

# Auth
JWT_SECRET=generate-a-secure-random-string-here
JWT_EXPIRES_IN=7d

# S3 Storage
S3_ENDPOINT=https://your-bucket.s3.amazonaws.com
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=support-helper-videos
S3_REGION=us-east-1

# OpenAI
OPENAI_API_KEY=sk-...

# App
NODE_ENV=production
API_PORT=3001
DASHBOARD_URL=https://your-dashboard.vercel.app

# Monitoring (optional)
SENTRY_DSN=https://...
```

### Step 4: Add Redis Service

1. In Railway, click "New" → "Database" → "Add Redis"
2. Copy the `REDIS_URL` to your API environment variables

### Step 5: Run Migrations

In Railway, open the API service shell:

```bash
npx prisma migrate deploy
```

Or set up a one-time job:
```bash
npx prisma migrate deploy && npx prisma db seed
```

### Step 6: Verify Deployment

- Check Railway logs for errors
- Test API health: `https://your-api.railway.app/api/health`
- Test Swagger docs: `https://your-api.railway.app/api/docs`

## Frontend Deployment (Vercel)

### Step 1: Import Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your GitHub repository

### Step 2: Configure Build Settings

```
Framework Preset: Next.js
Root Directory: apps/dashboard
Build Command: pnpm build
Output Directory: .next
Install Command: pnpm install
```

### Step 3: Add Environment Variables

```env
# API URL
NEXT_PUBLIC_API_URL=https://your-api.railway.app

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=https://...

# PostHog (optional)
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### Step 4: Deploy

Click "Deploy" and wait for the build to complete.

### Step 5: Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed

## Environment Variables

### Complete Production Configuration

#### API (.env)

```env
# ===========================================
# Database
# ===========================================
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# ===========================================
# Redis
# ===========================================
REDIS_URL=redis://default:password@host:6379

# ===========================================
# Auth
# ===========================================
JWT_SECRET=your-very-secure-jwt-secret-min-32-chars
JWT_EXPIRES_IN=7d

# ===========================================
# S3 Storage
# ===========================================
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=...
S3_BUCKET=support-helper-prod
S3_REGION=us-east-1

# ===========================================
# OpenAI
# ===========================================
OPENAI_API_KEY=sk-...

# ===========================================
# Meilisearch
# ===========================================
MEILISEARCH_HOST=https://ms-....meilisearch.io
MEILISEARCH_MASTER_KEY=...

# ===========================================
# GitHub OAuth (optional)
# ===========================================
GITHUB_CLIENT_ID=Iv1.xxx
GITHUB_CLIENT_SECRET=...
GITHUB_WEBHOOK_SECRET=...

# ===========================================
# App
# ===========================================
NODE_ENV=production
API_PORT=3001
DASHBOARD_URL=https://dashboard.support-helper.com
API_URL=https://api.support-helper.com

# ===========================================
# Monitoring
# ===========================================
SENTRY_DSN=https://xxx@sentry.io/xxx
BETTERSTACK_SOURCE_TOKEN=...
POSTHOG_API_KEY=phc_...
```

#### Dashboard (.env)

```env
NEXT_PUBLIC_API_URL=https://api.support-helper.com
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

## Post-Deployment

### 1. Verify Services

```bash
# Health check
curl https://your-api.railway.app/api/health

# API docs
open https://your-api.railway.app/api/docs
```

### 2. Create Initial Admin User

Either via seed script or manually:

```bash
# In Railway shell
npx prisma db seed
```

### 3. Configure CORS

Ensure `DASHBOARD_URL` matches your Vercel deployment URL.

### 4. Set Up Monitoring

- **Sentry**: Add DSN to both API and Dashboard
- **PostHog**: Add key to Dashboard
- **Better Stack**: Configure log forwarding

### 5. Configure S3 CORS

For your S3 bucket, add CORS configuration:

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://your-dashboard.vercel.app"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

## Alternative Platforms

### Render

Similar to Railway, supports monorepos:

```yaml
# render.yaml
services:
  - type: web
    name: support-helper-api
    env: node
    rootDir: apps/api
    buildCommand: pnpm install && pnpm build
    startCommand: node dist/main
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: support-helper-db
          property: connectionString
```

### Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy
cd apps/api
fly launch
fly secrets set DATABASE_URL=... JWT_SECRET=...
fly deploy
```

### Docker (Self-Hosted)

```bash
# Build production image
docker build -t support-helper-api -f apps/api/Dockerfile .

# Run with docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

## Monitoring

### Recommended Stack

| Tool | Purpose | Free Tier |
|------|---------|-----------|
| Sentry | Error tracking | 5K events/mo |
| Better Stack | Log management | 1GB/mo |
| PostHog | Analytics | 1M events/mo |
| UptimeRobot | Uptime monitoring | 50 monitors |

### Health Endpoints

```
GET /api/health          # Basic health check
GET /api/health/detailed # Detailed status (auth required)
```

### Alerts Configuration

Set up alerts for:
- API response time > 2s
- Error rate > 1%
- Database connection failures
- Redis connection failures
- Disk usage > 80%

## Troubleshooting

### Common Issues

**Database connection fails:**
- Check `DATABASE_URL` format includes `?sslmode=require`
- Verify IP whitelist in database provider

**CORS errors:**
- Verify `DASHBOARD_URL` matches exactly
- Check S3 CORS configuration

**Build failures:**
- Ensure all dependencies are listed
- Check Node.js version compatibility

**Memory issues:**
- Increase Railway/Render resources
- Optimize Prisma queries

### Logs

```bash
# Railway logs
railway logs

# Vercel logs
vercel logs

# Local debugging
NODE_ENV=production node dist/main
```

## Security Checklist

- [ ] Strong JWT secret (32+ characters)
- [ ] Database SSL enabled
- [ ] Environment variables not exposed
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] HTTPS enforced
- [ ] Sentry DSN configured
- [ ] Regular backups enabled
