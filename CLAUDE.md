# CLAUDE.md

## Project Overview

**Support Helper Platform** - AI-powered technical support system with video capture and automatic analysis. TypeScript monorepo: NestJS API, Next.js dashboard, BullMQ worker, web SDK.

## Quick Reference

- Build: `pnpm build` | Dev: `pnpm dev` (API :3001, Dashboard :3000)
- Test: `pnpm --filter @support-helper/<pkg> test -- --maxWorkers=2` (NEVER `pnpm test` globally)
- DB: `pnpm db:migrate` | `pnpm db:generate` | `pnpm db:studio`
- Push directly to `main` (remote: `supportHelperv2`). Build must pass before push.

## Resources

- API docs: http://localhost:3001/api/docs
- DB GUI: `pnpm db:studio`
- MinIO: http://localhost:9001
- MeiliSearch: http://localhost:7700
- MailHog: http://localhost:8025
