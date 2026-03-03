import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { InternalRoute } from '../../common/decorators/internal-route.decorator';
import { N1TriageService } from './n1-triage.service';

class InternalN1AssessDto {
  @IsString()
  @IsNotEmpty()
  ticketId: string;

  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsString()
  @IsNotEmpty()
  applicationId: string;
}

@ApiTags('N1 Triage')
@ApiBearerAuth()
@Controller('n1-triage')
@UseGuards(JwtAuthGuard)
export class N1TriageController {
  constructor(private readonly n1TriageService: N1TriageService) {}

  /**
   * Internal endpoint called by the worker to trigger N1 assessment.
   */
  @Post('internal/assess')
  @InternalRoute()
  @UseGuards(InternalAuthGuard)
  @ApiExcludeEndpoint()
  async internalAssess(@Body() dto: InternalN1AssessDto) {
    return this.n1TriageService.assess(
      dto.ticketId,
      dto.tenantId,
      dto.applicationId,
    );
  }

  @Get(':ticketId/assessment')
  @ApiOperation({ summary: 'Get N1 assessment for a ticket' })
  @ApiParam({ name: 'ticketId', type: String })
  @ApiResponse({ status: 200, description: 'N1 assessment data' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getAssessment(
    @CurrentTenant() tenantId: string,
    @Param('ticketId') ticketId: string,
  ) {
    return this.n1TriageService.getAssessment(ticketId, tenantId);
  }

  @Post(':ticketId/override')
  @ApiOperation({ summary: 'Override N1 decision — force escalation to N2' })
  @ApiParam({ name: 'ticketId', type: String })
  @ApiResponse({ status: 200, description: 'Decision overridden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async overrideDecision(
    @CurrentTenant() tenantId: string,
    @Param('ticketId') ticketId: string,
  ) {
    await this.n1TriageService.overrideDecision(ticketId, tenantId);
    return { success: true, message: 'Escalated to N2 deep analysis' };
  }
}
