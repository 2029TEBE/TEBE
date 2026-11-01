import { Controller, ForbiddenException, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { requireCapability } from '../common/require-capability';
import { StripeBillingService } from './stripe.service';
import { stripeTestOperatorAllowed } from './stripe-test-operator-policy';

/** C53: staging-only TEST operator ingress, never wired into customer UI.
 * TenantMiddleware requires a real session; a separate operator secret,
 * admin capability, TLS, and explicit staging flags are also mandatory.
 */
@Controller('api/v1/subscription/billing/stripe/operator')
export class StripeTestOperatorController {
  constructor(private readonly stripe: StripeBillingService) {}

  @Post('recurring-checkout')
  recurringCheckout(@Req() req: Request) {
    requireCapability('pmoa_admin');
    if (req.secure !== true || (req.body != null &&
        (typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length !== 0)))
      throw new ForbiddenException('Stripe TEST operator request rejected');
    if (!stripeTestOperatorAllowed(process.env, req.headers['x-epmo-stripe-test-operator-key']))
      throw new ForbiddenException('Stripe TEST operator entry is disabled');
    return this.stripe.prepareRecurringCheckout();
  }
}
