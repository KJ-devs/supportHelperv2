import {
  Controller,
  Get,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { GithubAppService } from '../services/github-app.service';

@ApiTags('GitHub App')
@Controller('github/app')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GithubAppController {
  constructor(private readonly appService: GithubAppService) {}

  /**
   * GET /github/app/info
   * Returns public info about the GitHub App (name, slug, install URL).
   */
  @Get('info')
  @ApiOperation({ summary: 'Get GitHub App public info and install URL' })
  async getAppInfo() {
    if (!this.appService.isEnabled()) {
      throw new BadRequestException(
        'GitHub App is not configured. Set GITHUB_APP_ID and GITHUB_PRIVATE_KEY in your .env file.',
      );
    }

    return this.appService.getAppInfo();
  }
}
