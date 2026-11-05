import { Controller, Get, Post, HttpCode, Req, ServiceUnavailableException } from '@nestjs/common';
import type { Request } from 'express';
import { PaddleWebhookIntake } from './paddle-webhook-intake';
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
  constructor(private readonly intake: PaddleWebhookIntake) {}
  @Post('paddle-webhook')
  @HttpCode(200)
  async paddleWebhook(@Req() req: Request & { rawBody?: Buffer }) {
    const result = await this.intake.accept(req.rawBody,req.header('paddle-signature'));
    return { received:result.received, duplicate:result.duplicate };
  }
}
