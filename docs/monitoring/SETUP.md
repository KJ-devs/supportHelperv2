# Monitoring Setup Guide

This guide walks you through setting up production monitoring and alerting for the Support Helper Platform.

## Quick Start

### 1. Enable Prometheus Metrics

Add to `.env.local`:
```env
PROMETHEUS_ENABLED=true
```

Restart API:
```bash
docker restart support-helper-api
```

Verify metrics endpoint:
```bash
curl http://localhost:3001/metrics
```

### 2. Start Monitoring Stack

```bash
# Start Prometheus, Alertmanager, Grafana, and exporters
docker-compose -f docker-compose.monitoring.yml up -d

# Verify services are running
docker-compose -f docker-compose.monitoring.yml ps
```

Access monitoring UIs:
- Prometheus: http://localhost:9090
- Alertmanager: http://localhost:9093
- Grafana: http://localhost:3100 (admin/admin)

### 3. Import Grafana Dashboard

1. Open Grafana at http://localhost:3100
2. Login with admin/admin (change password on first login)
3. Go to **Configuration** → **Data Sources** → **Add data source**
4. Select **Prometheus**
5. Set URL to `http://prometheus:9090`
6. Click **Save & Test**
7. Go to **Dashboards** → **Import**
8. Upload `monitoring/grafana/dashboard.json`
9. Select Prometheus data source
10. Click **Import**

### 4. Configure Slack Alerts

1. Create a Slack webhook:
   - Go to https://api.slack.com/messaging/webhooks
   - Create a new webhook for `#support-helper-alerts`
   - Copy the webhook URL

2. Add to `.env.local`:
   ```env
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

3. Restart Alertmanager:
   ```bash
   docker restart support-helper-alertmanager
   ```

4. Test alerting:
   ```bash
   # Send test alert
   curl -X POST http://localhost:9093/api/v1/alerts \
     -H 'Content-Type: application/json' \
     -d '[
       {
         "labels": {
           "alertname": "TestAlert",
           "severity": "info"
         },
         "annotations": {
           "summary": "This is a test alert",
           "description": "Testing Slack integration"
         }
       }
     ]'
   ```

   Check your Slack channel for the test alert.

## Production Setup

### Sentry Error Tracking

1. **Create Sentry project:**
   - Go to https://sentry.io
   - Create a new project (Node.js)
   - Copy the DSN

2. **Configure environment:**
   ```env
   SENTRY_DSN=https://your-key@sentry.io/project-id
   SENTRY_RELEASE=1.0.0
   SENTRY_TRACES_SAMPLE_RATE=0.1
   SENTRY_PROFILES_SAMPLE_RATE=0.1
   ```

3. **Restart API:**
   ```bash
   docker restart support-helper-api
   ```

4. **Verify in Sentry:**
   - Check Sentry dashboard for incoming events
   - Errors will appear in **Issues**
   - Performance data in **Performance**

### Better Stack Logging

1. **Create Better Stack account:**
   - Go to https://betterstack.com
   - Create a new source (Node.js)
   - Copy the source token

2. **Configure environment:**
   ```env
   BETTERSTACK_SOURCE_TOKEN=your-token
   LOG_LEVEL=info
   LOG_FORMAT=json
   ```

3. **Restart API:**
   ```bash
   docker restart support-helper-api
   ```

4. **Verify logs:**
   - Open Better Stack dashboard
   - Logs should appear in real-time
   - Use filters to search by level, tenant, etc.

### PostHog Analytics

1. **Create PostHog account:**
   - Go to https://posthog.com
   - Create a new project
   - Copy the API key

2. **Configure environment:**
   ```env
   POSTHOG_API_KEY=your-api-key
   POSTHOG_HOST=https://app.posthog.com
   ```

3. **Restart API:**
   ```bash
   docker restart support-helper-api
   ```

4. **Verify events:**
   - Open PostHog dashboard
   - Check **Events** for incoming activity
   - Set up funnels and insights

### Uptime Monitoring

**Option 1: UptimeRobot (Free)**

1. Go to https://uptimerobot.com
2. Add new monitor:
   - Type: HTTP(s)
   - URL: `https://api.yourdomain.com/health`
   - Interval: 5 minutes
3. Configure alert contacts (email, Slack, SMS)

**Option 2: Better Uptime (Paid)**

1. Go to https://betterstack.com/better-uptime
2. Add new monitor:
   - URL: `https://api.yourdomain.com/health`
   - Interval: 30 seconds
   - Expected status: 200
   - Alert on: 2 consecutive failures
3. Configure on-call rotation and escalation

**Configure webhook alerts:**
```env
UPTIME_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Alert Routing

Update `monitoring/prometheus/alertmanager.yml` with your Slack channels:

```yaml
global:
  slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'

receivers:
  - name: 'critical-alerts'
    slack_configs:
      - channel: '#your-critical-channel'
        # ... rest of config

  - name: 'warning-alerts'
    slack_configs:
      - channel: '#your-alerts-channel'
        # ... rest of config
```

Restart Alertmanager:
```bash
docker restart support-helper-alertmanager
```

## Alert Thresholds

Default thresholds are configured in `monitoring/prometheus/alerts.yml`. Adjust based on your needs:

| Alert | Default | Recommended Adjustment |
|-------|---------|------------------------|
| High Error Rate | >5% | Lower to 2-3% for stricter monitoring |
| Slow Response Time | p95 > 2s | Adjust based on SLA requirements |
| Queue Backlog | >1000 | Based on expected traffic volume |
| DB Connection Pool | >80% | Increase pool size if frequently alerting |
| Redis Memory | >80% | Increase Redis memory or adjust eviction |

To update thresholds, edit `monitoring/prometheus/alerts.yml` and reload Prometheus:

```bash
# Reload Prometheus configuration (hot reload)
curl -X POST http://localhost:9090/-/reload
```

## Metrics Endpoint Security

The `/metrics` endpoint is public by default for Prometheus scraping. For production:

### Option 1: Network-Level Restriction

Use Docker networks to isolate the metrics endpoint:
- API and Prometheus on same Docker network
- Metrics endpoint only accessible from Prometheus container

### Option 2: IP Whitelisting

Add IP-based access control in `apps/api/src/monitoring/metrics.controller.ts`:

```typescript
import { Ip } from '@nestjs/common';

@Get()
@Public()
async getMetrics(@Ip() ip: string): Promise<string> {
  const allowedIps = ['127.0.0.1', '::1', 'prometheus-container-ip'];

  if (!allowedIps.includes(ip)) {
    throw new ForbiddenException('Access denied');
  }

  return this.metricsService.getMetrics();
}
```

### Option 3: Basic Auth

Add HTTP basic authentication for Prometheus scraping:

```typescript
import { UseGuards } from '@nestjs/common';
import { BasicAuthGuard } from '../common/guards/basic-auth.guard';

@Get()
@Public()
@UseGuards(BasicAuthGuard)
async getMetrics(): Promise<string> {
  return this.metricsService.getMetrics();
}
```

Configure Prometheus to use basic auth in `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'support-helper-api'
    basic_auth:
      username: 'prometheus'
      password: 'your-secure-password'
    static_configs:
      - targets: ['api:3001']
```

## On-Call Schedule

Set up an on-call rotation using PagerDuty or Opsgenie:

### PagerDuty

1. Create a PagerDuty account
2. Create a service for Support Helper API
3. Configure escalation policy:
   - Level 1: Primary on-call (0-15 minutes)
   - Level 2: Secondary on-call (15-30 minutes)
   - Level 3: Engineering manager (30+ minutes)
4. Add integration with Alertmanager:
   ```yaml
   # In alertmanager.yml
   receivers:
     - name: 'pagerduty'
       pagerduty_configs:
         - service_key: 'your-pagerduty-service-key'
   ```

### Opsgenie

1. Create an Opsgenie account
2. Create a team and add members
3. Configure on-call schedules and rotations
4. Add Prometheus integration
5. Configure alert routing in Alertmanager

## Testing Alerts

### Manual Alert Testing

```bash
# Test critical alert
curl -X POST http://localhost:9093/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[
    {
      "labels": {
        "alertname": "HighErrorRate",
        "severity": "critical",
        "component": "api"
      },
      "annotations": {
        "summary": "Test: High error rate detected",
        "description": "This is a test alert for high error rate"
      }
    }
  ]'

# Test warning alert
curl -X POST http://localhost:9093/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[
    {
      "labels": {
        "alertname": "SlowResponseTime",
        "severity": "warning",
        "component": "api"
      },
      "annotations": {
        "summary": "Test: Slow response times",
        "description": "This is a test alert for slow responses"
      }
    }
  ]'
```

### Load Testing for Alerts

```bash
# Generate high error rate
# Repeatedly call a non-existent endpoint
for i in {1..100}; do
  curl http://localhost:3001/api/non-existent-endpoint &
done

# Generate slow responses
# Call a slow endpoint repeatedly
ab -n 1000 -c 50 http://localhost:3001/api/tickets

# Watch for alerts in Grafana and Slack
```

## Troubleshooting

### Metrics Endpoint Not Working

```bash
# Check if API is running
docker ps | grep api

# Check if PROMETHEUS_ENABLED is set
docker exec support-helper-api printenv | grep PROMETHEUS

# Check API logs
docker logs support-helper-api --tail 50

# Verify metrics endpoint manually
curl http://localhost:3001/metrics
```

### Prometheus Not Scraping

```bash
# Check Prometheus targets
open http://localhost:9090/targets

# Verify API is reachable from Prometheus container
docker exec support-helper-prometheus wget -O- http://api:3001/metrics

# Check Prometheus logs
docker logs support-helper-prometheus --tail 50

# Verify network connectivity
docker network inspect support-helper-network
```

### Alerts Not Firing

```bash
# Check alert rules are loaded
open http://localhost:9090/alerts

# Verify alert conditions
# Go to Prometheus → Graph
# Run the alert query manually

# Check Alertmanager status
open http://localhost:9093/#/status

# Check Alertmanager logs
docker logs support-helper-alertmanager --tail 50
```

### Slack Notifications Not Received

```bash
# Verify webhook URL is set
docker exec support-helper-alertmanager env | grep SLACK

# Test webhook manually
curl -X POST "YOUR_SLACK_WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d '{"text": "Test notification from Alertmanager"}'

# Check Alertmanager logs for errors
docker logs support-helper-alertmanager --tail 100 | grep -i error

# Verify alert routing config
docker exec support-helper-alertmanager cat /etc/alertmanager/alertmanager.yml
```

### Grafana Dashboard Not Showing Data

```bash
# Verify Prometheus data source is configured
# Grafana → Configuration → Data Sources

# Test data source connection
# Should show "Data source is working"

# Check Prometheus has data
# Go to http://localhost:9090/graph
# Run query: up{job="support-helper-api"}

# Verify dashboard queries
# Edit panel → Query Inspector
# Check for errors
```

## Best Practices

1. **Alert Fatigue:** Start with conservative thresholds and adjust based on false positives
2. **Runbooks:** Keep runbooks up-to-date with real incident learnings
3. **Post-Mortems:** Conduct blameless post-mortems for critical incidents
4. **Monitoring Coverage:** Add metrics for new features as they're deployed
5. **Regular Reviews:** Review dashboards and alerts quarterly
6. **Testing:** Test alert routing monthly to ensure on-call rotation works
7. **Documentation:** Keep monitoring docs in sync with infrastructure changes

## Next Steps

1. ✅ Enable Prometheus metrics
2. ✅ Start monitoring stack
3. ✅ Configure Slack alerts
4. ✅ Import Grafana dashboard
5. ⏳ Set up Sentry error tracking
6. ⏳ Configure Better Stack logging
7. ⏳ Set up uptime monitoring
8. ⏳ Configure on-call schedule
9. ⏳ Test alert delivery
10. ⏳ Review and tune alert thresholds

## Additional Resources

- [Production Monitoring Documentation](./README.md)
- [Alert Runbooks](../runbooks/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
