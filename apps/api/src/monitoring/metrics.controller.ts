import { Controller, Get, Header, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { MetricsService } from './metrics.service';

@ApiTags('Monitoring')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Prometheus metrics endpoint',
    description: 'Returns metrics in Prometheus exposition format. Only enabled if PROMETHEUS_ENABLED=true.',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics in Prometheus format',
    content: {
      'text/plain': {
        example: `# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/tickets",status_code="200",tenant_id="abc123"} 150

# HELP http_request_duration_seconds HTTP request latency in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/api/tickets",status_code="200",le="0.005"} 120
http_request_duration_seconds_bucket{method="GET",route="/api/tickets",status_code="200",le="0.01"} 145
http_request_duration_seconds_bucket{method="GET",route="/api/tickets",status_code="200",le="+Inf"} 150
http_request_duration_seconds_sum{method="GET",route="/api/tickets",status_code="200"} 1.25
http_request_duration_seconds_count{method="GET",route="/api/tickets",status_code="200"} 150`,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Metrics endpoint disabled (PROMETHEUS_ENABLED=false)',
  })
  async getMetrics(): Promise<string> {
    if (!this.metricsService.isEnabled()) {
      throw new NotFoundException('Metrics endpoint is disabled. Set PROMETHEUS_ENABLED=true to enable.');
    }

    return this.metricsService.getMetrics();
  }

  @Get('json')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async getMetricsJSON(): Promise<unknown> {
    if (!this.metricsService.isEnabled()) {
      throw new NotFoundException('Metrics endpoint is disabled. Set PROMETHEUS_ENABLED=true to enable.');
    }

    return this.metricsService.getMetricsJSON();
  }
}
