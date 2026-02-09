import {
  Controller,
  Post,
  Headers,
  Body,
  RawBodyRequest,
  Req,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { GithubWebhooksService } from '../services/github-webhooks.service';

@ApiTags('GitHub Webhooks')
@Controller('github/webhooks')
export class GithubWebhooksController {
  private readonly logger = new Logger(GithubWebhooksController.name);

  constructor(private readonly webhooksService: GithubWebhooksService) {}

  /**
   * POST /github/webhooks
   * Handle incoming GitHub webhooks
   * Verifies signature and processes events
   */
  @Post()
  @Public()
  @ApiOperation({ summary: 'Handle GitHub webhook events' })
  @ApiHeader({ name: 'x-github-event', description: 'GitHub event type' })
  @ApiHeader({ name: 'x-hub-signature-256', description: 'Webhook signature' })
  @ApiHeader({ name: 'x-github-delivery', description: 'Unique delivery ID' })
  async handleWebhook(
    @Headers('x-github-event') event: string,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Body() payload: any,
    @Req() req: RawBodyRequest<Request>
  ) {
    if (!event) {
      throw new UnauthorizedException('Missing x-github-event header');
    }

    if (!signature) {
      throw new UnauthorizedException('Missing x-hub-signature-256 header');
    }

    this.logger.log(`Received webhook: ${event} (${deliveryId})`);

    try {
      await this.webhooksService.processWebhook(event, payload, signature, deliveryId || 'unknown');

      return {
        received: true,
        event,
        deliveryId,
      };
    } catch (error) {
      this.logger.error(`Webhook processing error: ${error.message}`, error.stack);
      throw error;
    }
  }

}
