# Prometheus Metrics

## Overview

This module provides Prometheus-compatible metrics collection for monitoring and observability. Metrics are conditionally enabled via the `PROMETHEUS_ENABLED` environment variable.

## Features

- **HTTP request metrics** (count, duration)
- **Business metrics** (tickets created, agent tasks)
- **Job queue metrics** (BullMQ jobs)
- **Default system metrics** (CPU, memory, event loop lag)
- **Automatic path normalization** to prevent cardinality explosion
- **Graceful degradation** when disabled

## Configuration

### Environment Variables

```bash
# Enable Prometheus metrics (default: false)
PROMETHEUS_ENABLED=true
```

## Metrics Endpoint

When enabled, metrics are exposed at:

```
GET /metrics
```

This is a public endpoint (no authentication required) designed for Prometheus scraper consumption.

## Available Metrics

### HTTP Metrics

**`http_requests_total`** (Counter)
- Total number of HTTP requests
- Labels: `method`, `path`, `status`

**`http_request_duration_seconds`** (Histogram)
- HTTP request duration in seconds
- Labels: `method`, `path`
- Buckets: 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10 seconds

### Business Metrics

**`tickets_created_total`** (Counter)
- Total number of tickets created
- Labels: `tenant`

**`agent_tasks_total`** (Counter)
- Total number of agent tasks
- Labels: `status` (pending, in_progress, completed, failed)

**`agent_tasks_duration_seconds`** (Histogram)
- Agent task duration in seconds
- Buckets: 1, 5, 10, 30, 60, 120, 300, 600 seconds

### Job Queue Metrics

**`bullmq_jobs_total`** (Counter)
- Total number of BullMQ jobs
- Labels: `queue`, `status` (completed, failed, delayed, active)

### System Metrics

Default Node.js metrics from `prom-client`:
- `process_cpu_user_seconds_total`
- `process_cpu_system_seconds_total`
- `process_resident_memory_bytes`
- `process_heap_bytes`
- `nodejs_eventloop_lag_seconds`
- `nodejs_gc_duration_seconds`
- And many more...

## Usage

### Automatic HTTP Metrics

The `MetricsInterceptor` automatically records HTTP request metrics for all routes. No manual instrumentation needed.

### Manual Metrics Recording

```typescript
import { Injectable } from '@nestjs/common';
import { MetricsService } from '../modules/metrics/metrics.service';

@Injectable()
export class TicketsService {
  constructor(private readonly metricsService: MetricsService) {}

  async createTicket(tenantId: string, data: CreateTicketDto) {
    // Business logic...

    // Record metric
    this.metricsService.recordTicketCreated({ tenantId });

    return ticket;
  }
}
```

### Agent Task Metrics

```typescript
const startTime = Date.now();

// ... perform agent task ...

this.metricsService.recordAgentTask({
  status: 'completed',
  duration: Date.now() - startTime,
});
```

### Job Queue Metrics

```typescript
this.metricsService.recordBullMQJob({
  queue: 'video-analysis',
  status: 'completed',
});
```

## Prometheus Configuration

### Scrape Config

Add this to your Prometheus configuration:

```yaml
scrape_configs:
  - job_name: 'support-helper-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
```

### Grafana Dashboards

Example queries:

```promql
# Request rate by status
rate(http_requests_total[5m])

# 95th percentile response time
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Tickets created per tenant
rate(tickets_created_total[1h])

# Agent task success rate
rate(agent_tasks_total{status="completed"}[5m]) /
rate(agent_tasks_total[5m])
```

## Path Normalization

To prevent cardinality explosion, URL paths are automatically normalized:
- UUIDs replaced with `:id`
- Numeric IDs replaced with `:id`
- Multiple slashes collapsed

Examples:
- `/api/tickets/550e8400-e29b-41d4-a716-446655440000` → `/api/tickets/:id`
- `/api/tickets/123` → `/api/tickets/:id`

## Performance Impact

When disabled (`PROMETHEUS_ENABLED=false`):
- Minimal overhead (interceptors check `isEnabled()` and exit early)
- No metrics collection
- `/metrics` endpoint returns empty response

When enabled:
- Negligible performance impact (<1ms per request)
- Metrics stored in-memory
- Prometheus scrapes at configured interval (typically 15s)

## Best Practices

1. **Enable in production** for observability
2. **Use labels sparingly** to avoid cardinality explosion
3. **Set up alerting** on key metrics (error rate, response time)
4. **Monitor memory usage** if metric cardinality grows unexpectedly
5. **Use Grafana dashboards** for visualization

## Troubleshooting

### Metrics not appearing

1. Verify `PROMETHEUS_ENABLED=true` in environment
2. Check `/metrics` endpoint returns data
3. Verify Prometheus scrape config is correct
4. Check Prometheus logs for scrape errors

### High memory usage

1. Check metric cardinality (number of unique label combinations)
2. Verify path normalization is working
3. Consider reducing label dimensions
4. Increase Prometheus scrape interval if needed
