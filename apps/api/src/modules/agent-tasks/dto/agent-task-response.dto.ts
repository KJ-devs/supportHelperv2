import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ActionPlan, AgentTaskStatus } from '../types/action-plan.types';

export class AgentTaskResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  ticketId: string;

  @ApiProperty({
    enum: [
      'analyzing',
      'plan_ready',
      'plan_pending_review',
      'plan_approved',
      'generating',
      'code_ready',
      'code_pending_review',
      'code_approved',
      'pushing',
      'pr_created',
      'completed',
      'failed',
      'expired',
    ],
  })
  status: AgentTaskStatus;

  @ApiPropertyOptional({ type: 'object', nullable: true })
  actionPlan: ActionPlan | null;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' }, nullable: true })
  executionLog: Prisma.JsonValue[] | null;

  @ApiProperty()
  startedAt: Date;

  @ApiPropertyOptional({ nullable: true })
  completedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  error: string | null;

  @ApiPropertyOptional({ nullable: true })
  prNumber: number | null;

  @ApiPropertyOptional({ nullable: true })
  prUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  branchName: string | null;

  @ApiPropertyOptional({ nullable: true })
  reviewRequestedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  reviewedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  reviewedBy: string | null;

  @ApiPropertyOptional({ nullable: true })
  rejectionReason: string | null;

  @ApiProperty()
  createdAt: Date;
}
