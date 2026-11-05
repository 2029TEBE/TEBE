import { Controller, Get, Post, ServiceUnavailableException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { requireCapability } from '../common/require-capability';

/** Tenant-scoped self-service. Never accepts a tenant ID from the request. */
@Controller('api/v1/subscription')
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}
  @Get('current') current() { return this.subscriptions.current(); }
  @Get('history') history() { return this.subscriptions.history(); }
  @Get('events') events() { return this.subscriptions.events(); }
  @Get('plans') plans() { return this.subscriptions.plans(); }
  @Post('evaluation/start') startEvaluation() { return this.subscriptions.startEvaluation(); }
  @Post('cancel-at-period-end') cancelAtPeriodEnd() { requireCapability('pmoa_admin'); throw new ServiceUnavailableException('Paddle-managed cancellation is unavailable'); }
  @Post('resume') resume() { requireCapability('pmoa_admin'); throw new ServiceUnavailableException('Paddle-managed subscription changes are unavailable'); }
}
