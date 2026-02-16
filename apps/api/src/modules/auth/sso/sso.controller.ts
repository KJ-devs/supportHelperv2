import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards';
import { RequireFeature } from '../../license/decorators/require-feature.decorator';
import { SsoService } from './sso.service';
import { UpdateSsoConfigDto } from './dto';

interface RequestWithUser {
  user: {
    tenantId: string;
    id: string;
    email: string;
    role: string;
  };
}

@ApiTags('SSO Configuration')
@Controller('auth/sso')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@RequireFeature('sso')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get SSO configuration' })
  @ApiResponse({ status: 200, description: 'SSO configuration retrieved (secrets masked)' })
  @ApiResponse({ status: 404, description: 'SSO configuration not found' })
  async getConfig(@Request() req: RequestWithUser) {
    return this.ssoService.getConfig(req.user.tenantId);
  }

  @Put('config')
  @ApiOperation({ summary: 'Update SSO configuration' })
  @ApiResponse({ status: 200, description: 'SSO configuration updated' })
  @ApiResponse({ status: 400, description: 'Invalid configuration' })
  async updateConfig(@Request() req: RequestWithUser, @Body() dto: UpdateSsoConfigDto) {
    return this.ssoService.updateConfig(req.user.tenantId, dto);
  }

  @Delete('config')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete SSO configuration' })
  @ApiResponse({ status: 204, description: 'SSO configuration deleted' })
  @ApiResponse({ status: 404, description: 'SSO configuration not found' })
  async deleteConfig(@Request() req: RequestWithUser) {
    await this.ssoService.deleteConfig(req.user.tenantId);
  }

  @Post('test')
  @ApiOperation({ summary: 'Test SSO connection' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async testConnection(@Request() req: RequestWithUser) {
    return this.ssoService.testConnection(req.user.tenantId);
  }
}
