import { Controller, Get, Post, ServiceUnavailableException } from '@nestjs/common';
import { BillingService } from './billing.service';

/** Read-only tenant invoice and payment history during Paddle migration. */
@Controller('api/v1/subscription/billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}
  @Get('invoices') invoices() { return this.billing.invoices(); }
  @Get('payments') payments() { return this.billing.payments(); }
  @Get('exceptions') exceptions() { return this.billing.exceptions(); }
  @Get('reconciliation') reconciliation() { return this.billing.reconciliation(); }
  @Post('renewal-invoice') renewalInvoice() {
    throw new ServiceUnavailableException('Paddle renewal invoicing not yet enabled');
  }
}

/** Deliberately not a 2xx callback: unpersisted payments must be retried. */
@Controller('api/v1/billing')
export class BillingWebhookController {
  @Post('paddle-webhook') paddleWebhook() {
    throw new ServiceUnavailableException('Paddle settlement webhook not yet enabled');
  }
}
