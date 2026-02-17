# Production Monitoring and Alerting

This document describes the comprehensive monitoring and alerting setup for the Support Helper Platform.

## Table of Contents

- [Overview](#overview)
- [Monitoring Stack](#monitoring-stack)
- [Metrics](#metrics)
- [Alerts](#alerts)
- [Dashboards](#dashboards)
- [Setup](#setup)
- [Runbooks](#runbooks)

## Overview

The Support Helper Platform uses a multi-layered monitoring approach:

1. **Error Tracking** - Sentry for application errors and performance monitoring
2. **Metrics & Alerting** - Prometheus for metrics collection and Alertmanager for alerting
3. **Logging** - Better Stack (Logtail) for centralized structured logging
4. **Analytics** - PostHog for product analytics and user behavior
5. **Uptime Monitoring** - External uptime monitoring (UptimeRobot, Better Uptime)
6. **Dashboards** - Grafana for metrics visualization

## Monitoring Stack

### Sentry

**Purpose:** Error tracking, performance monitoring, and distributed tracing

**Features:**
- Automatic error capture with stack traces
- Performance monitoring (APM)
- Distributed tracing across services
- User context and breadcrumbs
- Release tracking
- Profiling (when available)

**Configuration:**
```env
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_RELEASE=1.0.0
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

**Key Features:**
- Sensitive headers automatically filtered (Authorization, x-sdk-key, Cookie)
- Tenant context attached to all errors
- Integration with Prisma, Express, HTTP client
- Breadcrumbs for request flow debugging

### Prometheus

**Purpose:** Metrics collection and time-series database

**Endpoint:** `GET /metrics` (Prometheus exposition format)

**Configuration:**
```env
PROMETHEUS_ENABLED=true
```

**Key Metrics:**
- HTTP request rate, duration, and errors
- Database query performance and connection pool
- Queue job processing and backlog
- Business metrics (tickets, video processing, AI analysis)
- Cache hit/miss rates
- Memory and CPU usage

**Access:**
- Metrics endpoint: `http://api:3001/metrics`
- JSON format (debug): `http://api:3001/metrics/json`

### Alertmanager

**Purpose:** Alert routing, grouping, and notification delivery

**Features:**
- Route alerts by severity (critical, warning, info)
- Slack integration with channel mentions
- Alert grouping and deduplication
- Inhibition rules to suppress redundant alerts
- Configurable repeat intervals

**Slack Channels:**
- `#support-helper-critical` - Critical alerts with @channel mentions
- `#support-helper-alerts` - Warning and info alerts

### Better Stack (Logtail)

**Purpose:** Centralized structured logging

**Configuration:**
```env
BETTERSTACK_SOURCE_TOKEN=your-token
BETTERSTACK_ENDPOINT=https://in.logs.betterstack.com
LOG_LEVEL=info
LOG_FORMAT=json
```

**Features:**
- Structured JSON logs
- Correlation ID tracking
- Tenant context in all logs
- Log aggregation and search
- Real-time log tailing

### PostHog

**Purpose:** Product analytics and user behavior tracking

**Configuration:**
```env
POSTHOG_API_KEY=your-api-key
POSTHOG_HOST=https://app.posthog.com
```

**Events Tracked:**
- User actions (ticket creation, video uploads)
- Feature usage
- Conversion funnels
- A/B test results

## Metrics

### HTTP Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by method, route, status code, tenant |
| `http_request_duration_seconds` | Histogram | Request latency distribution |
| `http_requests_in_flight` | Gauge | Current requests being processed |

**Example Queries:**
```promql
# Request rate by status code
sum(rate(http_requests_total[5m])) by (status_code)

# p95 response time
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))

# Error rate
sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
```

### Database Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `db_query_duration_seconds` | Histogram | Query duration by operation and model |
| `db_connections_active` | Gauge | Active database connections |
| `db_connections_idle` | Gauge | Idle connections in pool |

**Example Queries:**
```promql
# p95 query duration
histogram_quantile(0.95, sum(rate(db_query_duration_seconds_bucket[5m])) by (le, model, operation))

# Connection pool utilization
db_connections_active / (db_connections_active + db_connections_idle)
```

### Queue Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `queue_jobs_total` | Counter | Total jobs processed by queue and status |
| `queue_job_duration_seconds` | Histogram | Job processing duration |
| `queue_jobs_waiting` | Gauge | Jobs waiting in queue |
| `queue_jobs_active` | Gauge | Jobs currently being processed |
| `queue_jobs_failed_total` | Counter | Failed jobs by queue, job name, and error type |

**Example Queries:**
```promql
# Queue backlog
queue_jobs_waiting

# Job failure rate
sum(rate(queue_jobs_failed_total[5m])) by (queue) / sum(rate(queue_jobs_total[5m])) by (queue)

# p95 job duration
histogram_quantile(0.95, sum(rate(queue_job_duration_seconds_bucket[5m])) by (le, queue))
```

### Business Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `tickets_created_total` | Counter | Tickets created by tenant, source, severity |
| `tickets_resolved_total` | Counter | Tickets resolved by tenant and resolution time |
| `video_processing_duration_seconds` | Histogram | Video processing duration |
| `ai_analysis_duration_seconds` | Histogram | AI analysis duration by provider and model |
| `integration_sync_duration_seconds` | Histogram | Integration sync duration |
| `integration_sync_success_total` | Counter | Successful integration syncs |
| `integration_sync_failure_total` | Counter | Failed integration syncs |

### Cache Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `cache_hits_total` | Counter | Cache hits by key prefix |
| `cache_misses_total` | Counter | Cache misses by key prefix |

**Example Queries:**
```promql
# Cache hit rate
sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))
```

## Alerts

### Alert Severity Levels

| Severity | Description | Response Time | Notification |
|----------|-------------|---------------|--------------|
| **Critical** | Service down, data loss, or major functionality broken | Immediate (< 5 min) | Slack @channel mention |
| **Warning** | Degraded performance or potential issues | Within 1 hour | Slack notification |
| **Info** | Notable events for awareness | Next business day | Slack notification |

### Critical Alerts

1. **HighErrorRate** - API error rate > 5% for 2+ minutes
2. **VerySlowResponseTime** - p95 response time > 5s for 2+ minutes
3. **APIInstanceDown** - API instance unreachable for 1+ minute
4. **PostgreSQLDown** - Database unreachable for 1+ minute
5. **RedisDown** - Redis unreachable for 1+ minute
6. **QueueBacklogCritical** - Queue backlog > 5000 jobs for 2+ minutes
7. **WorkerInstanceDown** - Worker instance unreachable for 2+ minutes
8. **LowAPIAvailability** - API availability < 99% over 1 hour

### Warning Alerts

1. **SlowResponseTime** - p95 response time > 2s for 5+ minutes
2. **HighMemoryUsage** - Memory usage > 1.5GB for 5+ minutes
3. **DatabaseConnectionPoolHigh** - Connection pool > 80% full for 2+ minutes
4. **SlowDatabaseQueries** - p95 query time > 1s for 5+ minutes
5. **RedisMemoryHigh** - Redis memory > 80% for 5+ minutes
6. **QueueBacklogHigh** - Queue backlog > 1000 jobs for 5+ minutes
7. **HighJobFailureRate** - Job failure rate > 10% for 5+ minutes
8. **SlowVideoProcessing** - p95 video processing > 5 minutes for 10+ minutes
9. **SlowAIAnalysis** - p95 AI analysis > 30s for 10+ minutes
10. **HighIntegrationSyncFailureRate** - Integration sync failure rate > 20% for 10+ minutes

### Info Alerts

1. **CacheHitRateLow** - Cache hit rate < 70% for 10+ minutes

## Dashboards

### Grafana Dashboard

The main production monitoring dashboard includes:

**Performance Panels:**
- API request rate
- API response time (p95)
- Error rate (4xx and 5xx)
- Database query duration (p95)

**Resource Panels:**
- Database connection pool utilization
- Memory usage (RSS, Heap)
- Cache hit rate

**Queue Panels:**
- Queue backlog (waiting and active jobs)
- Queue job duration (p95)
- Queue job success rate

**Business Panels:**
- Video processing duration (p95)
- AI analysis duration (p95)
- Tickets created per minute
- Integration sync success rate

**Access:** Import `monitoring/grafana/dashboard.json` into Grafana

### Health Check Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /health` | Public | Comprehensive health check (all services) |
| `GET /health/live` | Public | Liveness probe (is process alive?) |
| `GET /health/ready` | Public | Readiness probe (ready to accept traffic?) |
| `GET /health/full` | JWT | Full health with all dependencies |
| `GET /health/db` | JWT | Database health only |
| `GET /health/redis` | JWT | Redis health only |
| `GET /health/cron` | JWT | Cron job status |
| `GET /health/queues` | JWT | Queue status and backlog |
| `GET /health/metrics` | JWT | Basic process metrics |
| `GET /health/cache` | JWT | Cache hit/miss metrics |

## Setup

### 1. Enable Prometheus Metrics

Add to `.env.local`:
```env
PROMETHEUS_ENABLED=true
```

### 2. Configure Sentry

```env
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_RELEASE=1.0.0
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

### 3. Configure Better Stack

```env
BETTERSTACK_SOURCE_TOKEN=your-token
LOG_LEVEL=info
LOG_FORMAT=json
```

### 4. Configure Slack Alerts

Update `monitoring/prometheus/alertmanager.yml`:
```yaml
global:
  slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
```

### 5. Deploy Monitoring Stack

Using Docker Compose:
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

This starts:
- Prometheus (port 9090)
- Alertmanager (port 9093)
- Grafana (port 3000)
- postgres_exporter (port 9187)
- redis_exporter (port 9121)
- node_exporter (port 9100)

### 6. Import Grafana Dashboard

1. Open Grafana at `http://localhost:3000`
2. Go to Dashboards → Import
3. Upload `monitoring/grafana/dashboard.json`

### 7. Configure Uptime Monitoring

**UptimeRobot** or **Better Uptime**:

Monitor endpoints:
- `https://api.yourdomain.com/health` every 5 minutes
- Alert on 2 consecutive failures

Configure webhook:
```env
UPTIME_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## Runbooks

Runbooks for each alert are available in `docs/runbooks/`:

- [high-error-rate.md](../runbooks/high-error-rate.md) - HighErrorRate alert
- [slow-response.md](../runbooks/slow-response.md) - SlowResponseTime alert
- [instance-down.md](../runbooks/instance-down.md) - Instance down alerts
- [db-connection-pool.md](../runbooks/db-connection-pool.md) - Database connection pool alerts
- [slow-queries.md](../runbooks/slow-queries.md) - Slow database queries
- [postgres-down.md](../runbooks/postgres-down.md) - PostgreSQL down alert
- [redis-down.md](../runbooks/redis-down.md) - Redis down alert
- [redis-memory.md](../runbooks/redis-memory.md) - Redis memory alerts
- [cache-hit-rate.md](../runbooks/cache-hit-rate.md) - Low cache hit rate
- [queue-backlog.md](../runbooks/queue-backlog.md) - Queue backlog alerts
- [job-failures.md](../runbooks/job-failures.md) - Job failure alerts
- [slow-video-processing.md](../runbooks/slow-video-processing.md) - Slow video processing
- [slow-ai-analysis.md](../runbooks/slow-ai-analysis.md) - Slow AI analysis
- [integration-failures.md](../runbooks/integration-failures.md) - Integration sync failures
- [high-memory.md](../runbooks/high-memory.md) - High memory usage
- [low-availability.md](../runbooks/low-availability.md) - Low API availability

## Recording Metrics in Your Code

### HTTP Requests

Metrics are automatically recorded by the `MetricsInterceptor` for all HTTP requests.

### Custom Business Metrics

Inject `MetricsService` and record metrics:

```typescript
import { MetricsService } from '../monitoring/metrics.service';

@Injectable()
export class TicketsService {
  constructor(private readonly metricsService: MetricsService) {}

  async createTicket(data: CreateTicketDto): Promise<Ticket> {
    // Create ticket
    const ticket = await this.prisma.ticket.create({ data });

    // Record metric
    this.metricsService.ticketsCreated.inc({
      tenant_id: data.tenantId,
      source: data.source,
      severity: data.severity,
    });

    return ticket;
  }

  async processVideo(mediaId: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Process video
      await this.videoProcessor.process(mediaId);

      // Record duration
      const durationSeconds = (Date.now() - startTime) / 1000;
      this.metricsService.videoProcessingDuration.observe(
        { tenant_id: media.tenantId, resolution: media.resolution },
        durationSeconds,
      );
    } catch (error) {
      // Error is automatically recorded by MetricsInterceptor
      throw error;
    }
  }
}
```

### Queue Jobs

```typescript
import { MetricsService } from '../monitoring/metrics.service';

@Processor('video-processing')
export class VideoProcessor {
  constructor(private readonly metricsService: MetricsService) {}

  @Process('analyze')
  async analyze(job: Job): Promise<void> {
    const startTime = Date.now();

    try {
      // Process job
      await this.doWork(job.data);

      // Record success
      this.metricsService.queueJobsTotal.inc({
        queue: 'video-processing',
        status: 'completed',
      });

      // Record duration
      const durationSeconds = (Date.now() - startTime) / 1000;
      this.metricsService.queueJobDuration.observe(
        { queue: 'video-processing', job_name: 'analyze' },
        durationSeconds,
      );
    } catch (error) {
      // Record failure
      this.metricsService.queueJobsFailed.inc({
        queue: 'video-processing',
        job_name: 'analyze',
        error_type: error.constructor.name,
      });

      throw error;
    }
  }
}
```

## On-Call Schedule

**Primary On-Call:** Responds to critical alerts within 5 minutes
**Secondary On-Call:** Backup if primary doesn't respond within 15 minutes

**Schedule:** Use PagerDuty, Opsgenie, or similar on-call rotation tool

**Escalation:**
1. Primary on-call (0-15 minutes)
2. Secondary on-call (15-30 minutes)
3. Engineering manager (30+ minutes)

## Incident Response

See [Incident Response Playbook](../runbooks/incident-response.md) for detailed procedures.

**Quick steps:**
1. Acknowledge the alert in Slack
2. Check the relevant runbook
3. Investigate using dashboards and logs
4. Mitigate the issue
5. Document the incident
6. Post-mortem (for critical incidents)
