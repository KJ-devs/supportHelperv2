import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Metrics Controller
 *
 * Exposes Prometheus metrics endpoint.
 * Public endpoint (no authentication required) for Prometheus scraper.
 */
@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description: 'Returns application metrics in Prometheus text format',
  })
  @ApiResponse({
    status: 200,
    description: 'Prometheus metrics',
    type: String,
  })
  async getMetrics(): Promise<string> {
    if (!this.metricsService.isEnabled()) {
      return '# Prometheus metrics disabled\n';
    }
    return this.metricsService.getMetrics();
  }
}
