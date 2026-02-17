# Runbook: Queue Backlog

**Alert:** `QueueBacklogHigh` / `QueueBacklogCritical`
**Severity:** Warning (>1000) / Critical (>5000)
**Threshold:** Queue has too many waiting jobs

## Description

This alert fires when a BullMQ queue has accumulated too many jobs waiting to be processed:
- **Warning:** >1000 waiting jobs for 5+ minutes
- **Critical:** >5000 waiting jobs for 2+ minutes

## Impact

- **User Experience:** Delayed video processing, AI analysis, notifications
- **Business Impact:** Tickets not analyzed promptly, integrations not syncing
- **System Health:** Redis memory usage increasing, potential queue overflow

## Initial Investigation

### 1. Check Queue Dashboard

Open Grafana and check:
- Current queue backlog by queue name
- Active jobs (are workers processing?)
- Job failure rate
- Queue trends over last hour

### 2. Check Queue Status

```bash
# Check queue metrics via API
curl -H "Authorization: Bearer YOUR_JWT" http://localhost:3001/health/queues

# Expected output:
# {
#   "queues": [
#     {
#       "name": "video-processing",
#       "waiting": 1234,
#       "active": 10,
#       "completed": 5678,
#       "failed": 12,
#       "delayed": 0,
#       "paused": false
#     }
#   ],
#   "deadLetterQueue": 5
# }
```

### 3. Check Worker Status

```bash
# Check if worker is running
docker ps | grep worker

# Check worker logs
docker logs support-helper-worker --tail 100 --follow

# Check worker health
curl http://localhost:3003/health
```

### 4. Check Redis Status

```bash
# Check Redis memory
docker exec -it support-helper-redis redis-cli INFO memory | grep used_memory

# Check Redis queue keys
docker exec -it support-helper-redis redis-cli KEYS "bull:*:wait" | wc -l
```

## Common Causes and Solutions

### Cause 1: Worker Not Running

**Symptoms:**
- `docker ps` shows no worker container
- Queue backlog increasing steadily
- Active jobs = 0

**Solution:**
```bash
# Start worker
docker-compose up -d worker

# Or restart worker
docker restart support-helper-worker

# Verify worker is processing
docker logs support-helper-worker --tail 20
```

### Cause 2: Worker Overloaded (Processing Too Slowly)

**Symptoms:**
- Worker is running
- Active jobs = max concurrency (default: 10)
- Jobs taking longer than expected

**Solution:**
```bash
# Check job processing time
# Look at queue_job_duration_seconds metric in Grafana

# Option 1: Increase worker concurrency
# Edit .env.local:
WORKER_CONCURRENCY=20

# Restart worker
docker restart support-helper-worker

# Option 2: Scale workers horizontally
docker-compose up -d --scale worker=3
```

### Cause 3: Jobs Failing and Retrying

**Symptoms:**
- High job failure rate in metrics
- Worker logs show repeated errors
- Failed jobs count increasing

**Solution:**
```bash
# Check failed jobs
docker exec -it support-helper-redis redis-cli ZCARD "bull:video-processing:failed"

# Inspect failed job details
curl -H "Authorization: Bearer YOUR_JWT" http://localhost:3001/health/queues

# Check worker logs for error patterns
docker logs support-helper-worker --tail 200 | grep ERROR

# If jobs are failing due to transient issue:
# 1. Fix the underlying issue (see error-specific runbooks)
# 2. Retry failed jobs manually (if BullBoard UI is available)

# If jobs are failing due to bad data:
# 1. Clear the failed queue
docker exec -it support-helper-redis redis-cli DEL "bull:video-processing:failed"
```

### Cause 4: Redis Memory Full

**Symptoms:**
- Redis memory usage at max
- Jobs cannot be added to queue
- Redis evicting keys (if maxmemory-policy is set)

**Solution:**
```bash
# Check Redis memory
docker exec -it support-helper-redis redis-cli INFO memory

# Check Redis maxmemory setting
docker exec -it support-helper-redis redis-cli CONFIG GET maxmemory

# Option 1: Increase Redis memory limit
# Edit docker-compose.yml:
command: >
  redis-server
  --maxmemory 512mb  # Increase from 256mb
  --maxmemory-policy allkeys-lru
  --appendonly yes

# Restart Redis
docker-compose down redis && docker-compose up -d redis

# Option 2: Clear completed jobs (if safe)
docker exec -it support-helper-redis redis-cli DEL "bull:video-processing:completed"
```

### Cause 5: Traffic Spike (Sudden Influx of Jobs)

**Symptoms:**
- Sudden spike in waiting jobs
- Normal processing rate
- No errors in logs

**Solution:**
```bash
# Check tickets created rate
# Look at tickets_created_total metric in Grafana

# This is normal behavior during traffic spikes
# Workers will eventually catch up

# If spike is sustained:
# 1. Scale workers horizontally
docker-compose up -d --scale worker=5

# 2. Increase worker concurrency
# Edit .env.local:
WORKER_CONCURRENCY=20

docker restart support-helper-worker

# 3. Monitor progress
watch -n 5 'curl -s -H "Authorization: Bearer YOUR_JWT" http://localhost:3001/health/queues | jq'
```

### Cause 6: Queue Paused

**Symptoms:**
- Queue status shows `paused: true`
- Active jobs = 0
- No jobs being processed

**Solution:**
```bash
# Check if queue is paused via API
curl -H "Authorization: Bearer YOUR_JWT" http://localhost:3001/health/queues | jq '.queues[] | select(.paused == true)'

# Resume queue (requires BullBoard UI or custom admin endpoint)
# If no admin UI available, restart worker to unpause
docker restart support-helper-worker
```

## Mitigation Steps

### Immediate (0-5 minutes)

1. **Acknowledge alert** in Slack
2. **Check if worker is running** (`docker ps`)
3. **Restart worker** if not running
4. **Check job failure rate** in metrics

### Short-term (5-15 minutes)

1. **Identify root cause** (worker down, overloaded, failures)
2. **Scale workers** if needed
3. **Monitor queue decrease** in Grafana
4. **Check for failed jobs** and retry if safe

### Long-term (post-incident)

1. **Review worker capacity** planning
2. **Optimize slow jobs** (video processing, AI analysis)
3. **Add auto-scaling** for workers based on queue depth
4. **Update alert thresholds** if false positive

## Escalation

If queue backlog continues growing after 20 minutes:

1. **Page secondary on-call** engineer
2. **Consider manual intervention** (clear queue, pause ingestion)
3. **Notify engineering manager** if critical features affected
4. **Communicate delays** to customers (if customer-facing impact)

## Prevention

### Monitoring

- ✅ Prometheus tracking queue backlog
- ✅ Alertmanager alerting on thresholds
- ⚠️ Add auto-scaling based on queue depth
- ⚠️ Add predictive alerts based on growth rate

### Capacity Planning

- Benchmark job processing times
- Load testing with realistic traffic patterns
- Worker concurrency tuning
- Redis memory sizing

### Code Quality

- Optimize slow job processing (FFmpeg, Tesseract, AI calls)
- Add timeouts to prevent stuck jobs
- Implement exponential backoff for retries
- Circuit breakers for external dependencies

## Related Alerts

- `HighJobFailureRate` - Jobs failing and retrying
- `WorkerInstanceDown` - Worker not running
- `RedisMemoryHigh` - Queue using too much memory
- `SlowVideoProcessing` - Jobs taking too long
- `SlowAIAnalysis` - AI analysis bottleneck

## Metrics to Watch

```promql
# Current queue backlog
queue_jobs_waiting

# Active jobs being processed
queue_jobs_active

# Job processing rate
rate(queue_jobs_total{status="completed"}[5m])

# Job failure rate
rate(queue_jobs_failed_total[5m]) / rate(queue_jobs_total[5m])

# Job processing duration (p95)
histogram_quantile(0.95, sum(rate(queue_job_duration_seconds_bucket[5m])) by (le, queue))

# Redis memory usage
redis_memory_used_bytes / redis_memory_max_bytes
```

## Queue Priority Guidelines

If multiple queues are backed up, prioritize in this order:

1. **email** - User-facing notifications (highest priority)
2. **webhooks** - Real-time integrations (high priority)
3. **ai-analysis** - Ticket analysis (medium priority)
4. **video-processing** - Video analysis (medium priority)
5. **search-indexing** - Search updates (low priority)
6. **maintenance** - Cleanup tasks (lowest priority)

## Post-Incident Checklist

- [ ] Queue backlog back to normal (<100)
- [ ] Workers processing at normal rate
- [ ] Root cause identified and documented
- [ ] Failed jobs cleared or retried
- [ ] Capacity scaled appropriately
- [ ] Monitoring confirmed working
- [ ] Follow-up tasks created
- [ ] Post-mortem scheduled (if critical)

## Contact Information

- **Primary On-Call:** Check PagerDuty schedule
- **Secondary On-Call:** Check PagerDuty schedule
- **Engineering Manager:** [Name] - [Phone/Slack]
- **Slack Channels:** `#support-helper-critical`, `#engineering`

## References

- [Production Monitoring Documentation](../monitoring/README.md)
- [Worker Architecture](../../apps/worker/README.md)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Grafana Dashboard](http://localhost:3100)
