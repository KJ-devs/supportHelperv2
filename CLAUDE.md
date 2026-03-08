# CLAUDE.md

## Project Overview

**Support Helper Platform** - AI-powered technical support system with video capture and automatic analysis. TypeScript monorepo: NestJS API, Next.js dashboard, BullMQ worker, web SDK.

## Quick Reference

- Setup: `pnpm install && pnpm docker:up && pnpm db:migrate`
- Build: `pnpm build` | Dev: `pnpm dev` (API :3001, Dashboard :3000)
- Test (one at a time, NEVER `pnpm test`): `pnpm --filter @support-helper/api test -- --maxWorkers=2`
- DB: `pnpm db:migrate` | `pnpm db:generate` | `pnpm db:studio`
- Push directly to `main` (remote: `supportHelperv2`). Build must pass before push.

## Resources

- Extended context: `.claude/rules/` (architecture, code-style, testing, commits, stability)
- Agent team: `.claude/team.md` | Orchestrator: `/forge`
- API docs: http://localhost:3001/api/docs
- DB GUI: `pnpm db:studio`
- MinIO: http://localhost:9001
- MeiliSearch: http://localhost:7700
- MailHog: http://localhost:8025
