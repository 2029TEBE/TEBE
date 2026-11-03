import { Body, Controller, Get, HttpCode, Post, Req, ServiceUnavailableException } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { BillingService } from './billing.service';
import { StripeBillingService } from './stripe.service';
import { z } from 'zod';
import { referenceSettlementSchema } from './billing.schemas';
import { ZodPipe } from '../common/zod.pipe';

/** Tenant billing endpoints use the authenticated tenant context. */
@Controller('api/v1/subscription/billing')
export class BillingController {
  constructor(private readonly billing: BillingService, private readonly stripe: StripeBillingService) {}
  @Get('invoices') invoices() { return this.billing.invoices(); }
  @Get('payments') payments() { return this.billing.payments(); }
  @Get('exceptions') exceptions() { return this.billing.exceptions(); }
  @Get('reconciliation') reconciliation() { return this.billing.reconciliation(); }
  @Post('renewal-invoice') renewalInvoice() { return this.billing.issueRenewalInvoice(); }
  @Post('stripe/checkout') checkout(@Body() body: unknown) {
    const parsed = new ZodPipe(z.object({ invoiceId: z.string().uuid() }).strict()).transform(body) as { invoiceId: string };
    return this.stripe.createCheckout(parsed.invoiceId);
  }
  /** TEST-only first-subscription Checkout. The service requires an authenticated
   * workspace admin, expired trial, approved Stripe TEST price and explicit
   * feature flag. The signed webhook is the only entitlement authority. */
  @Throttle({ default: { ttl: 60_000, limit: 2 } })
  @Post('stripe/recurring-checkout')
  recurringCheckout(@Body(new ZodPipe(z.object({}).strict())) _body: Record<string, never>) {
    // Independent customer-exposure switch: the existing C53 operator-only
    // preview does not authorize general customer access to TEST Checkout.
    if (process.env.DEPLOYMENT_ENV !== 'staging' || process.env.NODE_ENV !== 'production' ||
        process.env.STRIPE_RECURRING_CUSTOMER_CHECKOUT_ENABLED !== 'true')
      throw new ServiceUnavailableException('Customer TEST checkout is disabled');
    return this.stripe.prepareRecurringCheckout();
  }
}

/** A separate, HMAC-authenticated ingress. Does NOT accept session or tenant headers. */
@Controller('api/v1/billing')
export class BillingWebhookController {
  constructor(private readonly billing: BillingService, private readonly stripe: StripeBillingService) {}
  @Post('stripe-webhook')
  @HttpCode(200)
  stripeWebhook(@Req() req: Request & { rawBody?: Buffer }) {
    return this.stripe.webhook(req.rawBody, req.headers['stripe-signature']);
  }
  @Post('reference-webhook')
  @HttpCode(200)
  receive(@Req() req: Request & { rawBody?: Buffer }) {
    // Authenticate the exact bytes in service before any database mutation.
    const parsed = new ZodPipe(referenceSettlementSchema).transform(req.body);
    return this.billing.referenceWebhook(req.rawBody, req.headers['x-billing-timestamp'],
      req.headers['x-billing-signature'], parsed);
  }
}
