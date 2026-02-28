import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus metrics service for production monitoring.
 * Tracks HTTP requests, database queries, queue jobs, and custom business metrics.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly enabled: boolean;
  public readonly registry: Registry;

  // HTTP Metrics
  public readonly httpRequestsTotal: Counter;
  public readonly httpRequestDuration: Histogram;
  public readonly httpRequestsInFlight: Gauge;

  // Database Metrics
  public readonly dbQueryDuration: Histogram;
  public readonly dbConnectionsActive: Gauge;
  public readonly dbConnectionsIdle: Gauge;

  // Queue Metrics
  public readonly queueJobsTotal: Counter;
  public readonly queueJobDuration: Histogram;
  public readonly queueJobsWaiting: Gauge;
  public readonly queueJobsActive: Gauge;
  public readonly queueJobsFailed: Counter;

  // Business Metrics
  public readonly ticketsCreated: Counter;
  public readonly ticketsResolved: Counter;
  public readonly videoProcessingDuration: Histogram;
  public readonly aiAnalysisDuration: Histogram;
  public readonly integrationSyncDuration: Histogram;
  public readonly integrationSyncSuccess: Counter;
  public readonly integrationSyncFailure: Counter;

  // Cache Metrics
  public readonly cacheHits: Counter;
  public readonly cacheMisses: Counter;

  // Error Metrics
  public readonly errorsTotal: Counter;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('monitoring.prometheus.enabled', false);
    this.registry = new Registry();

    // Set default labels
    this.registry.setDefaultLabels({
      app: 'support-helper-api',
      environment: this.config.get<string>('app.nodeEnv', 'development'),
      version: this.config.get<string>('app.version', '0.1.0'),
    });

    // HTTP Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'tenant_id'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestsInFlight = new Gauge({
      name: 'http_requests_in_flight',
      help: 'Number of HTTP requests currently being processed',
      registers: [this.registry],
    });

    // Database Metrics
    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation', 'model'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
      registers: [this.registry],
    });

    this.dbConnectionsActive = new Gauge({
      name: 'db_connections_active',
      help: 'Number of active database connections',
      registers: [this.registry],
    });

    this.dbConnectionsIdle = new Gauge({
      name: 'db_connections_idle',
      help: 'Number of idle database connections in the pool',
      registers: [this.registry],
    });

    // Queue Metrics
    this.queueJobsTotal = new Counter({
      name: 'queue_jobs_total',
      help: 'Total number of queue jobs processed',
      labelNames: ['queue', 'status'],
      registers: [this.registry],
    });

    this.queueJobDuration = new Histogram({
      name: 'queue_job_duration_seconds',
      help: 'Queue job processing duration in seconds',
      labelNames: ['queue', 'job_name'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
      registers: [this.registry],
    });

    this.queueJobsWaiting = new Gauge({
      name: 'queue_jobs_waiting',
      help: 'Number of jobs waiting in queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.queueJobsActive = new Gauge({
      name: 'queue_jobs_active',
      help: 'Number of jobs currently being processed',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.queueJobsFailed = new Counter({
      name: 'queue_jobs_failed_total',
      help: 'Total number of failed queue jobs',
      labelNames: ['queue', 'job_name', 'error_type'],
      registers: [this.registry],
    });

    // Business Metrics
    this.ticketsCreated = new Counter({
      name: 'tickets_created_total',
      help: 'Total number of tickets created',
      labelNames: ['tenant_id', 'source', 'severity'],
      registers: [this.registry],
    });

    this.ticketsResolved = new Counter({
      name: 'tickets_resolved_total',
      help: 'Total number of tickets resolved',
      labelNames: ['tenant_id', 'resolution_time_bucket'],
      registers: [this.registry],
    });

    this.videoProcessingDuration = new Histogram({
      name: 'video_processing_duration_seconds',
      help: 'Video processing duration in seconds',
      labelNames: ['tenant_id', 'resolution'],
      buckets: [5, 10, 30, 60, 120, 300, 600],
      registers: [this.registry],
    });

    this.aiAnalysisDuration = new Histogram({
      name: 'ai_analysis_duration_seconds',
      help: 'AI analysis duration in seconds',
      labelNames: ['provider', 'model', 'analysis_type'],
      buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
      registers: [this.registry],
    });

    this.integrationSyncDuration = new Histogram({
      name: 'integration_sync_duration_seconds',
      help: 'Integration sync duration in seconds',
      labelNames: ['integration_type', 'tenant_id'],
      buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
      registers: [this.registry],
    });

    this.integrationSyncSuccess = new Counter({
      name: 'integration_sync_success_total',
      help: 'Total number of successful integration syncs',
      labelNames: ['integration_type', 'tenant_id'],
      registers: [this.registry],
    });

    this.integrationSyncFailure = new Counter({
      name: 'integration_sync_failure_total',
      help: 'Total number of failed integration syncs',
      labelNames: ['integration_type', 'tenant_id', 'error_type'],
      registers: [this.registry],
    });

    // Cache Metrics
    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_key_prefix'],
      registers: [this.registry],
    });

    this.cacheMisses = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_key_prefix'],
      registers: [this.registry],
    });

    // Error Metrics
    this.errorsTotal = new Counter({
      name: 'errors_total',
      help: 'Total number of errors by type',
      labelNames: ['error_type', 'error_code', 'route'],
      registers: [this.registry],
    });
  }

  onModuleInit() {
    if (this.enabled) {
      // Collect default Node.js metrics (CPU, memory, event loop, etc.)
      collectDefaultMetrics({ register: this.registry });
      console.log('[Metrics] Prometheus metrics enabled at /metrics');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get metrics in Prometheus exposition format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get metrics as JSON (for debugging)
   */
  async getMetricsJSON(): Promise<unknown> {
    return this.registry.getMetricsAsJSON();
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
    tenantId?: string,
  ): void {
    if (!this.enabled) return;

    this.httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode,
      tenant_id: tenantId || 'none',
    });

    this.httpRequestDuration.observe(
      { method, route, status_code: statusCode },
      durationSeconds,
    );
  }

  /**
   * Record database query
   */
  recordDbQuery(operation: string, model: string, durationSeconds: number): void {
    if (!this.enabled) return;
    this.dbQueryDuration.observe({ operation, model }, durationSeconds);
  }

  /**
   * Record error
   */
  recordError(errorType: string, errorCode: string, route: string): void {
    if (!this.enabled) return;
    this.errorsTotal.inc({ error_type: errorType, error_code: errorCode, route });
  }

  /**
   * Update database connection pool metrics
   */
  updateDbConnectionMetrics(active: number, idle: number): void {
    if (!this.enabled) return;
    this.dbConnectionsActive.set(active);
    this.dbConnectionsIdle.set(idle);
  }

  /**
   * Update queue metrics
   */
  updateQueueMetrics(queue: string, waiting: number, active: number): void {
    if (!this.enabled) return;
    this.queueJobsWaiting.set({ queue }, waiting);
    this.queueJobsActive.set({ queue }, active);
  }
}
