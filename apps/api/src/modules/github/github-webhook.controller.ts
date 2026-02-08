import {
  Controller,
  Post,
  Headers,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GithubService } from './github.service';
import { Public } from '../../common/decorators/public.decorator';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@ApiTags('GitHub Webhooks')
@Controller('webhooks/github')
export class GithubWebhookController {
  constructor(
    private readonly githubService: GithubService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Handle GitHub webhook events' })
  async handleWebhook(
    @Headers('x-github-event') event: string,
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: any,
  ) {
    // Verify webhook signature
    const webhookSecret = this.config.get('github.webhookSecret');
    if (webhookSecret) {
      const expectedSignature =
        'sha256=' +
        crypto
          .createHmac('sha256', webhookSecret)
          .update(JSON.stringify(payload))
          .digest('hex');

      if (signature !== expectedSignature) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    await this.githubService.handleWebhook(event, payload);

    return { received: true };
  }
}
