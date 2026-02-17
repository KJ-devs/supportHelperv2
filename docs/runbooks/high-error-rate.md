# Runbook: High Error Rate

**Alert:** `HighErrorRate`
**Severity:** Critical
**Threshold:** API error rate > 5% for 2+ minutes

## Description

This alert fires when more than 5% of HTTP requests to the API are returning 5xx server errors over a 2-minute window.

## Impact

- **User Experience:** Users experiencing service errors and degraded functionality
- **Business Impact:** Tickets cannot be created, data cannot be accessed
- **Data Integrity:** Potential data loss if errors are in write operations

## Initial Investigation

### 1. Check Error Dashboard

Open Grafana dashboard and check:
- Current error rate percentage
- Which endpoints are failing (group by route)
- Error status codes (500, 502, 503, 504)
- Recent spike in request volume

### 2. Check Sentry

1. Open Sentry: https://sentry.io/organizations/your-org/issues/
2. Filter by last 15 minutes
3. Look for:
   - Recurring error patterns
   - New error types
   - Stack traces pointing to specific code paths

### 3. Check Application Logs

```bash
# Check recent API logs
docker logs support-helper-api --tail 100 --follow

# Or via Better Stack
# https://logs.betterstack.com - filter by last 15 minutes
```

Look for:
- Exception stack traces
- Database connection errors
- Redis connection errors
- External API timeouts

### 4. Check Dependencies

```bash
# Check database health
curl http://localhost:3001/health/db

# Check Redis health
curl http://localhost:3001/health/redis

# Check S3/MinIO health
docker logs support-helper-minio --tail 50
```

## Common Causes and Solutions

### Cause 1: Database Connection Pool Exhausted

**Symptoms:**
- Errors: `Cannot acquire connection from pool`
- Database connections at max capacity

**Solution:**
```bash
# Check current connections
docker exec -it support-helper-postgres psql -U support -d support_helper -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections if needed
docker exec -it support-helper-postgres psql -U support -d support_helper -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < NOW() - INTERVAL '5 minutes';"

# Restart API to reset connection pool
docker restart support-helper-api
```

### Cause 2: Redis Down or Unreachable

**Symptoms:**
- Errors: `ECONNREFUSED redis:6379`
- Cache operations failing

**Solution:**
```bash
# Check Redis status
docker ps | grep redis

# Restart Redis
docker restart support-helper-redis

# If Redis is healthy, check network
docker network inspect support-helper-network
```

### Cause 3: Memory Leak or High Memory Usage

**Symptoms:**
- Process memory > 1.5GB
- Node.js heap errors
- Slow response times

**Solution:**
```bash
# Check memory usage
docker stats support-helper-api

# Restart API to reclaim memory
docker restart support-helper-api

# Take heap snapshot for analysis (if time permits)
curl http://localhost:3001/health/metrics
```

### Cause 4: External Service Timeout

**Symptoms:**
- Errors in AI provider calls (OpenAI, Anthropic)
- Integration API timeouts (Jira, HubSpot, Slack)

**Solution:**
```bash
# Check external service status
# OpenAI: https://status.openai.com
# Anthropic: https://status.anthropic.com

# If provider is down, consider:
# 1. Failing gracefully with fallback behavior
# 2. Queueing requests for retry
# 3. Temporarily disabling affected features
```

### Cause 5: Unhandled Exception in New Deployment

**Symptoms:**
- Error rate spiked after recent deployment
- New error types in Sentry
- Specific routes failing

**Solution:**
```bash
# Rollback to previous version
git log --oneline -10  # Find previous commit
git checkout <previous-commit>
docker-compose down
docker-compose up -d --build

# Or use Docker image tags
docker pull support-helper-api:previous-tag
docker-compose up -d
```

## Mitigation Steps

### Immediate (0-5 minutes)

1. **Acknowledge alert** in Slack to notify team
2. **Check dashboard** for error rate and affected endpoints
3. **Restart failing service** if obvious cause (memory, connections)

### Short-term (5-15 minutes)

1. **Investigate root cause** using logs and Sentry
2. **Apply fix** (restart, rollback, kill connections, etc.)
3. **Verify error rate** is decreasing in Grafana
4. **Monitor for recurrence** over next 10 minutes

### Long-term (post-incident)

1. **Document incident** in incident log
2. **Create follow-up tasks** for permanent fix
3. **Update monitoring** if blind spots discovered
4. **Schedule post-mortem** if critical incident

## Escalation

If error rate does not decrease after 15 minutes:

1. **Page secondary on-call** engineer
2. **Notify engineering manager** in `#engineering` channel
3. **Consider service degradation** announcement to customers
4. **Coordinate team response** via war room (Zoom call)

## Prevention

### Monitoring

- ✅ Sentry error tracking enabled
- ✅ Prometheus metrics tracking error rate
- ✅ Alertmanager alerting on >5% error rate
- ⚠️ Consider pre-emptive alerts at 2-3% error rate

### Code Quality

- Comprehensive error handling
- Circuit breakers for external services
- Database connection pool monitoring
- Memory leak testing in CI/CD

### Capacity Planning

- Load testing before major releases
- Database connection pool tuning
- Memory limits configured in Docker
- Auto-scaling for traffic spikes

## Related Alerts

- `VerySlowResponseTime` - May precede error rate spike
- `DatabaseConnectionPoolHigh` - Often correlated
- `HighMemoryUsage` - May cause errors
- `RedisDown` - Cache failures cause errors

## Metrics to Watch

```promql
# Current error rate
sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))

# Errors by route
sum(rate(http_requests_total{status_code=~"5.."}[5m])) by (route)

# Errors by status code
sum(rate(http_requests_total{status_code=~"5.."}[5m])) by (status_code)

# Database connection pool
db_connections_active / (db_connections_active + db_connections_idle)

# Memory usage
process_resident_memory_bytes / 1024 / 1024 / 1024
```

## Post-Incident Checklist

- [ ] Error rate back to normal (<1%)
- [ ] Root cause identified and documented
- [ ] Fix applied or rollback completed
- [ ] Monitoring confirmed working
- [ ] Incident logged with timeline
- [ ] Follow-up tasks created
- [ ] Post-mortem scheduled (if critical)
- [ ] Customer communication sent (if needed)

## Contact Information

- **Primary On-Call:** Check PagerDuty schedule
- **Secondary On-Call:** Check PagerDuty schedule
- **Engineering Manager:** [Name] - [Phone/Slack]
- **Slack Channels:** `#support-helper-critical`, `#engineering`

## References

- [Production Monitoring Documentation](../monitoring/README.md)
- [Incident Response Playbook](./incident-response.md)
- [Sentry Dashboard](https://sentry.io)
- [Grafana Dashboard](http://localhost:3100)
