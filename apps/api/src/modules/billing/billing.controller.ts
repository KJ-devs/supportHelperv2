import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { BillingService } from './billing.service';

class CreateCheckoutDto {
  @IsString()
  @IsNotEmpty()
  priceId: string;
}

/**
 * BillingController — exposes billing endpoints for the dashboard.
 *
 * All routes require JWT authentication and operate on the current tenant.
 */
@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * Create a Stripe Checkout session to subscribe to a paid plan.
   * Returns a redirect URL to Stripe-hosted checkout.
   */
  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a Stripe Checkout session' })
  @ApiBody({ schema: { type: 'object', properties: { priceId: { type: 'string' } }, required: ['priceId'] } })
  @ApiResponse({ status: 200, description: 'Checkout session URL returned' })
  @ApiResponse({ status: 400, description: 'Invalid price ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createCheckout(
    @Body() dto: CreateCheckoutDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ url: string }> {
    return this.billingService.createCheckoutSession(tenantId, dto.priceId);
  }

  /**
   * Create a Stripe Customer Portal session for self-service billing management.
   * Returns a redirect URL to the Stripe-hosted portal.
   */
  @Post('portal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a Stripe Customer Portal session' })
  @ApiResponse({ status: 200, description: 'Portal session URL returned' })
  @ApiResponse({ status: 400, description: 'No Stripe customer for this tenant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPortal(@CurrentTenant() tenantId: string): Promise<{ url: string }> {
    return this.billingService.createPortalSession(tenantId);
  }

  /**
   * Get the current subscription status for the tenant.
   */
  @Get('subscription')
  @ApiOperation({ summary: 'Get current subscription status' })
  @ApiResponse({ status: 200, description: 'Subscription status returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSubscription(@CurrentTenant() tenantId: string) {
    return this.billingService.getSubscription(tenantId);
  }
}
