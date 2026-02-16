import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as promClient from 'prom-client';
import { HttpMetrics, TicketMetrics, AgentTaskMetrics, JobMetrics } from './metrics.types';

/**
 * Prometheus Metrics Service
 *
 * Provides application metrics for monitoring and observability.
 * Only active when PROMETHEUS_ENABLED=true
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly enabled: boolean;
  private registry: promClient.Registry;

  // HTTP Metrics
  private httpRequestsTotal: promClient.Counter<string>;
  private httpRequestDuration: promClient.Histogram<string>;

  // Business Metrics
  private ticketsCreatedTotal: promClient.Counter<string>;
  private agentTasksTotal: promClient.Counter<string>;
  private agentTaskDuration: promClient.Histogram<string>;

  // BullMQ Job Metrics
  private bullmqJobsTotal: promClient.Counter<string>;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('PROMETHEUS_ENABLED') === true ||
                   this.config.get<string>('PROMETHEUS_ENABLED') === 'true';

    if (this.enabled) {
      this.initializeMetrics();
    }
  }

  onModuleInit() {
    if (this.enabled) {
      console.log('[Metrics] Prometheus metrics enabled');
    }
  }

  private initializeMetrics() {
    // Create a new registry
    this.registry = new promClient.Registry();

    // Add default metrics (CPU, memory, etc.)
    promClient.collectDefaultMetrics({ register: this.registry });

    // HTTP Request Counter
    this.httpRequestsTotal = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    // HTTP Request Duration Histogram
    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    // Tickets Created Counter
    this.ticketsCreatedTotal = new promClient.Counter({
      name: 'tickets_created_total',
      help: 'Total number of tickets created',
      labelNames: ['tenant'],
      registers: [this.registry],
    });

    // Agent Tasks Counter
    this.agentTasksTotal = new promClient.Counter({
      name: 'agent_tasks_total',
      help: 'Total number of agent tasks',
      labelNames: ['status'],
      registers: [this.registry],
    });

    // Agent Task Duration Histogram
    this.agentTaskDuration = new promClient.Histogram({
      name: 'agent_tasks_duration_seconds',
      help: 'Agent task duration in seconds',
      buckets: [1, 5, 10, 30, 60, 120, 300, 600],
      registers: [this.registry],
    });

    // BullMQ Jobs Counter
    this.bullmqJobsTotal = new promClient.Counter({
      name: 'bullmq_jobs_total',
      help: 'Total number of BullMQ jobs',
      labelNames: ['queue', 'status'],
      registers: [this.registry],
    });
  }

  /**
   * Check if metrics are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get metrics in Prometheus text format
   */
  async getMetrics(): Promise<string> {
    if (!this.enabled) {
      return '';
    }
    return this.registry.metrics();
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(metrics: HttpMetrics) {
    if (!this.enabled) return;

    const { method, path, statusCode, duration } = metrics;

    // Normalize path to avoid cardinality explosion
    const normalizedPath = this.normalizePath(path);

    this.httpRequestsTotal.inc({
      method,
      path: normalizedPath,
      status: statusCode.toString(),
    });

    this.httpRequestDuration.observe(
      { method, path: normalizedPath },
      duration / 1000 // Convert ms to seconds
    );
  }

  /**
   * Record ticket creation
   */
  recordTicketCreated(metrics: TicketMetrics) {
    if (!this.enabled) return;

    this.ticketsCreatedTotal.inc({
      tenant: metrics.tenantId,
    });
  }

  /**
   * Record agent task
   */
  recordAgentTask(metrics: AgentTaskMetrics) {
    if (!this.enabled) return;

    this.agentTasksTotal.inc({
      status: metrics.status,
    });

    if (metrics.duration !== undefined) {
      this.agentTaskDuration.observe(metrics.duration / 1000);
    }
  }

  /**
   * Record BullMQ job
   */
  recordBullMQJob(metrics: JobMetrics) {
    if (!this.enabled) return;

    this.bullmqJobsTotal.inc({
      queue: metrics.queue,
      status: metrics.status,
    });
  }

  /**
   * Normalize URL path to prevent cardinality explosion
   * Replaces UUIDs and numeric IDs with placeholders
   */
  private normalizePath(path: string): string {
    return path
      // Replace UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      // Replace numeric IDs
      .replace(/\/\d+/g, '/:id')
      // Replace multiple consecutive slashes
      .replace(/\/+/g, '/');
  }
}
