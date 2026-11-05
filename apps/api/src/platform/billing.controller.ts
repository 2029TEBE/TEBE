import { Controller, Get, Post, ServiceUnavailableException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { requireCapability } from '../common/require-capability';

/** Read-only tenant ledger while signed Paddle settlement remains unverified. */
@Controller('api/v1/subscription/billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}
  @Get('invoices') invoices() { return this.billing.invoices(); }
  @Get('payments') payments() { return this.billing.payments(); }
  @Get('exceptions') exceptions() { return this.billing.exceptions(); }
  @Get('reconciliation') reconciliation() { return this.billing.reconciliation(); }
  @Post('renewal-invoice') renewalInvoice() {
    requireCapability('pmoa_admin');
    throw new ServiceUnavailableException('Paddle invoicing is unavailable until signed settlement is verified');
  }
}

/** Unpersisted callbacks must never receive a successful response. */
@Controller('api/v1/billing')
export class BillingWebhookController {
  @Post('paddle-webhook') paddleWebhook() {
    throw new ServiceUnavailableException('Paddle signed webhook settlement is not yet enabled');
  }
}
