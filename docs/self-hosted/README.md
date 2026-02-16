# Self-Hosted Documentation

This directory contains documentation for self-hosting Support Helper Platform.

## Quick Links

- **[Installation Guide](./installation.md)** - Complete setup instructions using Docker Compose
- **[Updating Guide](./updating.md)** - How to update your installation
- **[Backup & Restore Guide](./backup-restore.md)** - Backup and restore procedures

## Overview

Support Helper Platform can be self-hosted using Docker Compose. The production stack includes:

- **API** (NestJS) - REST API and WebSocket server
- **Dashboard** (Next.js) - Admin interface
- **Worker** (NestJS) - Background job processor
- **PostgreSQL** - Primary database with pgvector
- **Redis** - Cache and job queue
- **MinIO** - S3-compatible object storage

## Getting Started

1. Follow the [Installation Guide](./installation.md)
2. Configure your environment variables
3. Start the stack with `docker compose -f docker-compose.prod.yml up -d`
4. Access the dashboard at `http://localhost:3000`

## Maintenance

- **Updating** - Use `./scripts/update.sh` for automated updates with backup and rollback
- **Backup & Restore** - Comprehensive guide in [backup-restore.md](./backup-restore.md)
  - Manual backups with `./scripts/backup.sh`
  - Automated backups via cron with `./scripts/backup-cron.sh`
  - Full restore procedure with `./scripts/restore.sh`
  - Cloud storage sync (S3, GCS, Azure)
- **Monitoring** - Health checks at `/health`, `/health/live`, and `/health/ready`

## Support

For issues or questions:
- Check the [Installation Guide](./installation.md) troubleshooting section
- Review logs: `docker compose -f docker-compose.prod.yml logs -f`
- Open an issue on GitHub: [KJ-devs/supportHelperv2](https://github.com/KJ-devs/supportHelperv2)
