# Monitoring and Logging Guide

This guide covers how to set up and use structured logging, metrics, and monitoring for your self-hosted Support Helper Platform installation.

## Table of Contents

- [Structured Logging](#structured-logging)
- [Request Correlation](#request-correlation)
- [Prometheus Metrics](#prometheus-metrics)
- [Grafana + Loki Setup](#grafana--loki-setup)
- [Alerting](#alerting)
- [Troubleshooting](#troubleshooting)

## Structured Logging

Support Helper uses structured JSON logging for easy parsing and analysis. All logs include context information that helps you trace requests through your system.

### Log Format

Logs are output in JSON format with the following fields:

```json
{
  "timestamp": "2026-02-16T10:30:45.123Z",
  "level": "info",
  "service": "api",
  "message": "Ticket created successfully",
  "request_id": "req_abc123def456",
  "user_id": "user_789xyz",
  "tenant_id": "tenant_456klm",
  "context": {
    "ticket_id": "ticket_123abc",
    "severity": "high",
    "duration_ms": 245
  },
  "trace_id": "trace_abc123",
  "span_id": "span_def456"
}
```

### Log Levels

Configure the log level using the `LOG_LEVEL` environment variable:

| Level | Usage | Example |
|-------|-------|---------|
| `error` | Critical errors and failures | Database connection errors, API failures |
| `warn` | Warnings and potential issues | Rate limit approaching, slow query |
| `info` | General informational messages | Request completed, job started |
| `debug` | Detailed diagnostic information | Request parameters, computed values |

### Configuration

Set the log level in your `.env.local`:

```bash
# Log level (default: info)
LOG_LEVEL=info
```

Changes take effect on the next service restart:

```bash
docker compose -f docker-compose.prod.yml restart api worker dashboard
```

### Log Output Format

**Development mode** (pretty-printed):
```
[10:30:45] INFO [api] Ticket created successfully
  └─ request_id: req_abc123def456
  └─ ticket_id: ticket_123abc
  └─ duration: 245ms
```

**Production mode** (JSON):
```json
{"timestamp":"2026-02-16T10:30:45.123Z","level":"info","service":"api","message":"Ticket created successfully","request_id":"req_abc123def456","ticket_id":"ticket_123abc","duration_ms":245}
```

### Log Sanitization

Sensitive data is automatically redacted from logs:

- API keys and tokens (redacted as `***`)
- Password fields (redacted as `***`)
- Credit card numbers
- Social Security numbers
- Personal email addresses (PII)

Example:

```json
{
  "message": "Authentication attempt",
  "user_email": "user@***",
  "api_key": "sk-***",
  "status": "success"
}
```

### Viewing Logs

View logs in real-time:

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml logs -f dashboard

# Last 50 lines
docker compose -f docker-compose.prod.yml logs --tail=50 api

# With timestamps
docker compose -f docker-compose.prod.yml logs -f -t api
```

### Querying JSON Logs

Extract specific information from logs using `jq`:

```bash
# Find all errors in the last hour
docker compose logs api | jq 'select(.level=="error")'

# Find requests slower than 1 second
docker compose logs api | jq 'select(.duration_ms > 1000)'

# Find all tickets created by a specific user
docker compose logs api | jq 'select(.message=="Ticket created successfully" and .user_id=="user_789xyz")'

# Count errors by service
docker compose logs | jq -s 'group_by(.service) | map({service: .[0].service, errors: (map(select(.level=="error")) | length)})'
```

## Request Correlation

The `X-Request-Id` header allows you to trace a single request as it flows through your system. Every request is automatically assigned a unique ID that propagates across services.

### X-Request-Id Header

Every HTTP request receives a unique request ID:

```bash
curl -v http://localhost:3001/api/tickets
```

Response headers include the request ID:

```
X-Request-Id: req_abc123def456
```

You can also provide your own request ID:

```bash
curl -H "X-Request-Id: my-custom-id-12345" http://localhost:3001/api/tickets
```

### Tracing a Request

Follow a ticket creation request from the API through the worker:

1. **Client submits ticket via SDK**

```bash
curl -X POST http://localhost:3001/api/sdk/tickets/report \
  -H "X-SDK-Key: sk_test123" \
  -H "X-Request-Id: req_trace_001" \
  -F "title=Button not working" \
  -F "video=@video.mp4"
```

2. **API processes and logs the request**

Filter logs by request ID:

```bash
docker compose logs api | jq 'select(.request_id=="req_trace_001")'
```

Output:
```json
{
  "timestamp": "2026-02-16T10:30:45.123Z",
  "level": "info",
  "service": "api",
  "message": "Ticket report received",
  "request_id": "req_trace_001",
  "tenant_id": "tenant_123",
  "media_id": "media_456"
}
```

3. **Worker picks up video analysis job**

Filter worker logs by the same request ID:

```bash
docker compose logs worker | jq 'select(.request_id=="req_trace_001")'
```

Output:
```json
{
  "timestamp": "2026-02-16T10:31:02.456Z",
  "level": "info",
  "service": "worker",
  "message": "Starting video analysis",
  "request_id": "req_trace_001",
  "media_id": "media_456",
  "duration_ms": 12000
}
```

4. **Track the entire flow**

Combine logs from all services:

```bash
docker compose logs | jq 'select(.request_id=="req_trace_001")' | sort_by(.timestamp)
```

This gives you a complete timeline of the request across all services.

### Request Flow Example

```
Client SDK                API                    Worker
     |                     |                       |
     |--POST ticket------> |                       |
     |                     |--extract frames----> |
     |                     |                     |
     |                     |<--keyframes-------  |
     |                     |                       |
     |                     |--analyze frames----> |
     |                     |                     |
     |                     |<--AI results-------  |
     |                     |--update ticket---> |
     |                     |                       |
     | <--ticket created-- |                       |
     |                     |                       |
```

All steps are linked by the request ID in logs.

## Prometheus Metrics

Prometheus metrics provide time-series data on application performance and behavior.

### Enable Prometheus Metrics

Set in `.env.local`:

```bash
# Enable Prometheus metrics endpoint (default: false)
PROMETHEUS_ENABLED=true
```

Restart services:

```bash
docker compose -f docker-compose.prod.yml restart api worker
```

### Access Metrics

Metrics are available at the `/metrics` endpoint:

```bash
curl http://localhost:3001/metrics
```

Output:
```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="POST",path="/api/sdk/tickets/report",status="200"} 127.0

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="POST",path="/api/sdk/tickets/report",le="0.1"} 120.0
http_request_duration_seconds_bucket{method="POST",path="/api/sdk/tickets/report",le="0.5"} 126.0
http_request_duration_seconds_bucket{method="POST",path="/api/sdk/tickets/report",le="1.0"} 127.0
http_request_duration_seconds_sum{method="POST",path="/api/sdk/tickets/report"} 45.32
http_request_duration_seconds_count{method="POST",path="/api/sdk/tickets/report"} 127.0
```

### Available Metrics

#### HTTP Request Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_requests_total` | Counter | `method`, `path`, `status` | Total HTTP requests by method, path, and status code |
| `http_request_duration_seconds` | Histogram | `method`, `path` | Request duration in seconds (p50, p95, p99) |

Example queries:
```promql
# Requests per second
rate(http_requests_total[1m])

# Requests by status code
http_requests_total{status=~"5.."}

# P99 response time
histogram_quantile(0.99, http_request_duration_seconds_bucket)
```

#### Business Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `tickets_created_total` | Counter | `tenant`, `severity` | Total tickets created |
| `tickets_analyzed_total` | Counter | `tenant`, `status` | Total tickets analyzed (success/failed) |
| `agent_tasks_total` | Counter | `status` | Total agent tasks (pending/running/success/failed) |
| `agent_tasks_duration_seconds` | Histogram | None | Agent task duration in seconds |

#### Background Job Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `bullmq_jobs_total` | Counter | `queue`, `status` | Total BullMQ jobs (video-analysis, github-sync, search-index, notifications) |
| `bullmq_job_duration_seconds` | Histogram | `queue` | Job duration in seconds |
| `bullmq_queue_size` | Gauge | `queue` | Current number of jobs in queue |
| `bullmq_active_jobs` | Gauge | `queue` | Currently processing jobs |

Example queries:
```promql
# Failed video analysis jobs
increase(bullmq_jobs_total{queue="video-analysis",status="failed"}[1h])

# Queue backlog
bullmq_queue_size{queue="video-analysis"}

# Average job duration
avg(bullmq_job_duration_seconds_bucket{queue="video-analysis"}) by (le)
```

#### System Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `process_cpu_seconds_total` | Counter | Total CPU time in seconds |
| `process_resident_memory_bytes` | Gauge | Memory usage in bytes |
| `process_uptime_seconds` | Counter | Process uptime in seconds |
| `nodejs_event_loop_lag_seconds` | Gauge | Event loop lag (indicates performance issues) |

## Grafana + Loki Setup

Combine Grafana for visualization with Loki for log aggregation.

### Docker Compose Configuration

Add Loki and Grafana to your `docker-compose.prod.yml`:

```yaml
services:
  loki:
    image: grafana/loki:2.10.0
    ports:
      - "3100:3100"
    environment:
      - LOG_LEVEL=info
    volumes:
      - ./config/loki-config.yml:/etc/loki/local-config.yaml
      - ./data/loki:/loki
    command: -config.file=/etc/loki/local-config.yaml
    networks:
      - support-helper
    healthcheck:
      test: [ "CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3100/ready" ]
      interval: 30s
      timeout: 10s
      retries: 3

  grafana:
    image: grafana/grafana:10.2.2
    ports:
      - "3200:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_INSTALL_PLUGINS=grafana-clock-panel
    volumes:
      - ./data/grafana:/var/lib/grafana
      - ./config/grafana-provisioning:/etc/grafana/provisioning
    networks:
      - support-helper
    depends_on:
      - loki
    healthcheck:
      test: [ "CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health" ]
      interval: 30s
      timeout: 10s
      retries: 3

  # Configure Docker to send logs to Loki
  api:
    # ... existing config ...
    logging:
      driver: loki
      options:
        loki-url: "http://loki:3100/loki/api/v1/push"
        loki-batch-size: "400"

  worker:
    # ... existing config ...
    logging:
      driver: loki
      options:
        loki-url: "http://loki:3100/loki/api/v1/push"
        loki-batch-size: "400"

  dashboard:
    # ... existing config ...
    logging:
      driver: loki
      options:
        loki-url: "http://loki:3100/loki/api/v1/push"
        loki-batch-size: "400"

networks:
  support-helper:
    driver: bridge
```

### Loki Configuration

Create `config/loki-config.yml`:

```yaml
auth_enabled: false

ingester:
  chunk_idle_period: 3m
  max_chunk_age: 1h
  max_streams_per_user: 10000
  chunk_retain_on_error: true
  lifecycler:
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema:
        version: v11
        index:
          prefix: index_
          period: 24h

server:
  http_listen_port: 3100
  log_level: info

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks
```

### Grafana Data Source Setup

1. Access Grafana at `http://localhost:3200` (default: admin/admin)
2. Go to Configuration → Data Sources
3. Click "Add data source"
4. Select "Loki"
5. Set URL to `http://loki:3100`
6. Click "Save & Test"

### Grafana Dashboards

#### Example: Request Performance Dashboard

Create `config/grafana-provisioning/dashboards/requests.json`:

```json
{
  "dashboard": {
    "title": "Request Performance",
    "panels": [
      {
        "title": "Requests per second",
        "targets": [
          {
            "expr": "rate(http_requests_total[1m])",
            "legendFormat": "{{method}} {{path}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Response time (p99)",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "{{method}} {{path}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error rate"
          }
        ],
        "type": "gauge"
      }
    ]
  }
}
```

#### Example: Worker Jobs Dashboard

```json
{
  "dashboard": {
    "title": "Background Jobs",
    "panels": [
      {
        "title": "Jobs by queue",
        "targets": [
          {
            "expr": "rate(bullmq_jobs_total[5m])",
            "legendFormat": "{{queue}} - {{status}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Failed jobs",
        "targets": [
          {
            "expr": "increase(bullmq_jobs_total{status=\"failed\"}[1h])",
            "legendFormat": "{{queue}}"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Queue size",
        "targets": [
          {
            "expr": "bullmq_queue_size",
            "legendFormat": "{{queue}}"
          }
        ],
        "type": "stat"
      }
    ]
  }
}
```

### Log Queries in Grafana

Example Loki queries:

```logql
# All logs from API service
{job="docker", container_name="api"}

# Errors only
{job="docker"} | level=error

# Logs by request ID
{job="docker"} | json | request_id="req_trace_001"

# Video analysis logs
{job="docker", container_name="worker"} | json | message="Starting video analysis"

# Slow requests (>1 second)
{job="docker", container_name="api"} | json | duration_ms > 1000 | rate(1m)
```

## Alerting

Set up Grafana alerts to notify you of issues.

### Alert Rules

#### High Error Rate

Alert when error rate exceeds 5%:

```yaml
alert: HighErrorRate
expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
for: 5m
labels:
  severity: critical
annotations:
  summary: "High error rate (> 5%)"
  description: "Error rate is {{ $value | humanizePercentage }}"
```

#### Slow Response Time

Alert when p99 response time exceeds 2 seconds:

```yaml
alert: SlowResponseTime
expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2
for: 10m
labels:
  severity: warning
annotations:
  summary: "Slow response time (p99 > 2s)"
  description: "P99 response time is {{ $value | humanizePercentage }}"
```

#### Failed Background Jobs

Alert when job failure rate exceeds 10%:

```yaml
alert: HighJobFailureRate
expr: rate(bullmq_jobs_total{status="failed"}[5m]) / rate(bullmq_jobs_total[5m]) > 0.1
for: 5m
labels:
  severity: critical
annotations:
  summary: "High job failure rate (> 10%)"
  description: "Job failure rate is {{ $value | humanizePercentage }}"
```

#### Queue Backlog

Alert when queue has more than 1000 pending jobs:

```yaml
alert: QueueBacklog
expr: bullmq_queue_size > 1000
for: 10m
labels:
  severity: warning
annotations:
  summary: "Large queue backlog"
  description: "{{ $labels.queue }} queue has {{ $value }} pending jobs"
```

### Configuring Notifications

In Grafana, go to Alerting → Notification channels and add:

**Slack:**
1. Get webhook URL from Slack API
2. Create notification channel with Slack webhook
3. Attach to alert rules

**Email:**
1. Configure SMTP in Grafana settings
2. Create email notification channel
3. Attach to alert rules

**PagerDuty:**
1. Get integration key from PagerDuty
2. Create notification channel with PagerDuty key
3. Attach to alert rules

## Troubleshooting

### Logs Not Appearing

**Problem:** No logs in Docker output

```bash
docker compose logs api
# Returns empty or only recent logs
```

**Solution:** Check if logging is enabled

```bash
# View service configuration
docker compose config | grep -A 5 logging

# Enable debug logging temporarily
docker compose restart -e LOG_LEVEL=debug api
```

### High Memory Usage in Loki

**Problem:** Loki is consuming too much memory

```bash
docker stats loki
# MEMORY USAGE above expected
```

**Solution:** Adjust Loki configuration

```yaml
# config/loki-config.yml
ingester:
  max_streams_per_user: 5000  # Reduce from 10000
  chunk_idle_period: 2m       # Reduce from 3m
```

Restart Loki:

```bash
docker compose -f docker-compose.prod.yml restart loki
```

### Prometheus Metrics Not Appearing

**Problem:** `/metrics` endpoint returns 404

**Solution:** Check if Prometheus is enabled

```bash
# Check environment variable
docker compose exec api env | grep PROMETHEUS

# Enable and restart
echo "PROMETHEUS_ENABLED=true" >> .env.local
docker compose -f docker-compose.prod.yml restart api
```

### Request ID Not Found in Logs

**Problem:** Can't find logs for a specific request

```bash
docker compose logs | jq 'select(.request_id=="my-request-id")'
# Returns empty
```

**Solution:** Request may have completed before Docker captures logs

- Increase log buffer with `--tail=1000`
- Use Loki for longer retention
- Ensure `X-Request-Id` header is being sent

### Grafana Dashboard Not Loading

**Problem:** Dashboard shows "No data"

**Solution:** Verify data source connection

1. Go to Grafana → Configuration → Data Sources
2. Click Loki or Prometheus
3. Click "Test"
4. If test fails, check:
   - Loki/Prometheus is running: `docker compose ps loki`
   - Network connectivity: `docker compose exec grafana ping loki`
   - Correct URL in data source

### Loki Disk Space Issues

**Problem:** Loki storage filling up

```bash
du -sh ./data/loki
# 50G+ usage
```

**Solution:** Adjust retention policy

```yaml
# config/loki-config.yml
limits_config:
  retention_period: 168h  # Keep logs for 7 days instead of unlimited
```

Restart Loki:

```bash
docker compose -f docker-compose.prod.yml restart loki
```

### Slow Queries in Grafana

**Problem:** Dashboards loading slowly

**Solution:** Optimize queries

```logql
# Instead of: {job="docker"} | json
# Use: {job="docker", container_name="api"} | json

# Instead of: rate(...[1m]) for 24h range
# Use: rate(...[5m]) for 24h range
```

## Best Practices

1. **Log Rotation** - Use log drivers with retention policies
2. **Alert Thresholds** - Tune based on your baseline
3. **Regular Testing** - Test alerts to ensure notifications work
4. **Performance Monitoring** - Track metrics like CPU, memory, disk
5. **Security** - Don't expose metrics/logs publicly (use network isolation)
6. **Retention** - Balance storage costs with investigation needs
7. **Documentation** - Keep runbooks for common alerts

## Related Documentation

- [Installation Guide](./installation.md) - Initial setup
- [Updating Guide](./updating.md) - How to update
- [Backup & Restore Guide](./backup-restore.md) - Data protection
- [README](./README.md) - Overview and quick links
