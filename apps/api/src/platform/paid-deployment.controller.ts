import { Controller, Get, Header, ForbiddenException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { withTenant } from '@pmo/db';
import { currentContext } from '../tenancy/tenant-context';
import { assertRuntimeDeploymentTenant, parseRuntimeDeployment } from '../tenancy/deployment-runtime';

/**
 * Running NestJS endpoint, unlike the standalone E76 HTTP adapter.
 * Session identity is established by TenantMiddleware and AsyncLocalStorage;
 * never accept a tenant, payment status or deployment from request headers.
 *
 * A subscription row is NOT a provider receipt: staging must separately prove
 * that only verified settlement can activate it. This endpoint fails closed
 * when the deployment inventory is absent.
 */
@Controller('api/v1/platform/deployment')
export class PaidDeploymentController {
  // Entitlements can be revoked at any time; never cache authorization results.
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @Get('paid-access')
  async paidAccess() {
    try {
      // Missing request context must fail with the same generic denial as a
      // revoked or unbound tenant; never expose middleware internals.
      const { tenantId, userId } = currentContext();
      // A historical Stripe paid row cannot authorize access after the
      // merchant-selected provider changes to Paddle. New authorization must
      // depend on independently verified Paddle settlement once implemented.
      // Conflicting provider enablement must never authorize historical Stripe evidence.
      if (process.env.BILLING_PROVIDER !== 'stripe' || process.env.STRIPE_ENABLED !== 'true' || process.env.PADDLE_ENABLED === 'true')
        throw new Error('Provider-specific entitlements are not integrated or enabled');
      if (!tenantId || !userId) throw new Error('Missing authenticated tenant');
      // An active flag alone is not proof of a paid subscription. Require
      // immutable webhook and provider-payment evidence for the *same* current
      // period, tenant, subscription, invoice, event and PaymentIntent.
      const runtime = parseRuntimeDeployment(process.env);
      if (!runtime) throw new Error('Deployment inventory missing');
      assertRuntimeDeploymentTenant(runtime, { tenantId, userId });
      const binding = runtime.tenantBindings.get(tenantId);
      if (!binding) throw new Error('Unbound tenant');
      const result = await withTenant(tenantId, tx => tx.execute(sql`
        SELECT s.id
        FROM tenant_subscriptions s
        WHERE s.tenant_id = ${tenantId}
          AND s.id = (
            SELECT newest.id FROM tenant_subscriptions newest
            WHERE newest.tenant_id = ${tenantId}
            ORDER BY newest.created_at DESC, newest.id DESC LIMIT 1
          )
          AND s.status = 'active'
          AND s.period_starts_at <= now()
          AND s.period_ends_at > now()
          AND EXISTS (
            SELECT 1
            FROM subscription_events e
            JOIN billing_invoices i
              ON i.tenant_id = e.tenant_id
             AND i.subscription_id = e.subscription_id
             AND i.id::text = e.details ->> 'invoiceId'
            JOIN billing_payments p
              ON p.tenant_id = i.tenant_id
             AND p.invoice_id = i.id
             AND p.provider = 'stripe'
             AND p.provider_payment_id = e.details ->> 'paymentIntent'
             AND p.provider_event_id = e.details ->> 'eventId'
            JOIN billing_webhook_receipts r
              ON r.tenant_id = p.tenant_id
             AND r.invoice_id = p.invoice_id
             AND r.provider = 'stripe'
             AND r.provider_event_id = p.provider_event_id
             AND r.payload_sha256 ~ '^[a-f0-9]{64}$'
            WHERE e.tenant_id = s.tenant_id
              AND e.subscription_id = s.id
              AND e.event_type IN (
                'billing.stripe_recurring_invoice_settled',
                'subscription.renewed_after_verified_settlement'
              )
              AND i.status = 'paid'
              AND i.period_starts_at = s.period_starts_at
              AND i.period_ends_at = s.period_ends_at
          )
        LIMIT 1
      `));
      if (!Array.isArray(result) || result.length !== 1)
        throw new Error('No signed-webhook-backed paid entitlement');
      return {
        deploymentId: runtime.deploymentId,
        profile: runtime.profile,
        region: runtime.region,
        apiOrigin: runtime.apiOrigin,
      };
    } catch {
      // No database error, subscription IDs, tenant IDs or token details leak.
      throw new ForbiddenException('Access unavailable');
    }
  }
}
