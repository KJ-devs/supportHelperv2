import { ApiProperty } from '@nestjs/swagger';

export class UsageMetricDto {
  @ApiProperty({ example: 'tickets' })
  metric: string;

  @ApiProperty({ example: 45 })
  current: number;

  @ApiProperty({ example: 500 })
  limit: number;

  @ApiProperty({ example: 9, description: 'Usage percentage (0-100)' })
  percentage: number;
}

export class UsageAlertDto {
  @ApiProperty({ example: 'agent_tasks' })
  metric: string;

  @ApiProperty({ example: 82 })
  percentage: number;

  @ApiProperty({ example: 'Agent tasks usage at 82%' })
  message: string;
}

export class UsageResponseDto {
  @ApiProperty({ example: 'pro' })
  plan: string;

  @ApiProperty({ type: [UsageMetricDto] })
  metrics: UsageMetricDto[];

  @ApiProperty({ example: '2026-12-31T00:00:00.000Z', nullable: true })
  expiresAt: string | null;

  @ApiProperty({ type: [UsageAlertDto] })
  alerts: UsageAlertDto[];
}

export class UsageSeriesDto {
  @ApiProperty({ example: 'tickets' })
  metric: string;

  @ApiProperty({ example: [30, 45, 38, 52, 41, 45] })
  data: number[];
}

export class UsageHistoryResponseDto {
  @ApiProperty({
    example: ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02'],
  })
  months: string[];

  @ApiProperty({ type: [UsageSeriesDto] })
  series: UsageSeriesDto[];
}
