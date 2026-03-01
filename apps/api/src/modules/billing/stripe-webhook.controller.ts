import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request } from 'express';
import Stripe from 'stripe';
import { Public } from '../../common/decorators/public.decorator';
import { BillingService } from './billing.service';

/**
 * StripeWebhookController — receives raw Stripe webhook events.
 *
 * IMPORTANT: This endpoint must receive the raw (unparsed) request body
 * for Stripe signature verification. NestJS must be bootstrapped with
 * `rawBody: true` in main.ts for this to work.
 *
 * Always returns HTTP 200 to Stripe, even on processing errors, to prevent
 * Stripe from retrying with the same event.
 */
@ApiExcludeController()
@Controller('billing/webhook')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly billingService: BillingService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: boolean }> {
    const rawBody = req.rawBody;

    if (!rawBody) {
      throw new BadRequestException(
        'Missing raw body. Ensure rawBody:true is set in NestFactory.create().',
      );
    }

    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      event = this.billingService.constructWebhookEvent(rawBody, signature);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Webhook signature verification failed: ${message}`);
      throw new BadRequestException(`Webhook Error: ${message}`);
    }

    // Dispatch event — always return 200 to Stripe regardless of processing errors
    try {
      await this.dispatchEvent(event);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Failed to process webhook event ${event.type} (${event.id}): ${message}`);
      // Return 200 anyway — Stripe should not retry on application errors
    }

    return { received: true };
  }

  private async dispatchEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing Stripe event: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.billingService.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case 'customer.subscription.updated':
        await this.billingService.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.deleted':
        await this.billingService.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'invoice.payment_failed':
        await this.billingService.handlePaymentFailed(
          event.data.object as Stripe.Invoice,
        );
        break;

      default:
        this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }
  }
}
