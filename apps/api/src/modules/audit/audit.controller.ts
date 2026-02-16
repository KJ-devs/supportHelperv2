import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { LicenseFeatureGuard } from '../license/guards/license-feature.guard';
import { RequireFeature } from '../license/decorators/require-feature.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserPayload } from '../../common/interfaces/user-payload.interface';
import { AuditService } from './audit.service';
import { FilterAuditLogsDto } from './dto/filter-audit-logs.dto';

@ApiTags('Audit Logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, LicenseFeatureGuard)
@RequireFeature('audit_logs')
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get audit logs with filters and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit logs retrieved successfully',
  })
  async findAll(
    @CurrentUser() user: UserPayload,
    @Query() filters: FilterAuditLogsDto,
  ) {
    return this.auditService.findAll(user.tenantId, filters);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export audit logs as CSV' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'CSV file generated successfully',
    headers: {
      'Content-Type': {
        description: 'text/csv',
        schema: { type: 'string' },
      },
      'Content-Disposition': {
        description: 'attachment; filename=audit-logs.csv',
        schema: { type: 'string' },
      },
    },
  })
  async exportCsv(
    @CurrentUser() user: UserPayload,
    @Query() filters: FilterAuditLogsDto,
    @Res() res: Response,
  ) {
    const csvContent = await this.auditService.exportCsv(user.tenantId, {
      actorId: filters.actorId,
      action: filters.action,
      resourceType: filters.resourceType,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(HttpStatus.OK).send(csvContent);
  }
}
