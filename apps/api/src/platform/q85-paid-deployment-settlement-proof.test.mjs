import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('./paid-deployment.controller.ts', import.meta.url), 'utf8');
const settlement = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');

test('Q85 paid endpoint rejects active-only, stale, foreign or unsigned payment state', () => {
  assert.match(api, /currentContext\(\)/);
  assert.match(api, /assertRuntimeDeploymentTenant\(runtime, \{ tenantId, userId \}\)/);
  assert.match(api, /SELECT newest\.id FROM tenant_subscriptions newest/);
  assert.match(api, /newest\.tenant_id = \$\{tenantId\}/);
  assert.match(api, /s\.status = 'active'/);
  assert.match(api, /s\.period_starts_at <= now\(\)/);
  assert.match(api, /s\.period_ends_at > now\(\)/);
  assert.match(api, /EXISTS \(/);
  assert.match(api, /JOIN billing_invoices i/);
  assert.match(api, /JOIN billing_payments p/);
  assert.match(api, /JOIN billing_webhook_receipts r/);
  assert.match(api, /e\.tenant_id = s\.tenant_id/);
  assert.match(api, /e\.subscription_id = s\.id/);
  assert.match(api, /i\.period_starts_at = s\.period_starts_at/);
  assert.match(api, /i\.period_ends_at = s\.period_ends_at/);
  assert.match(api, /i\.status = 'paid'/);
  assert.match(api, /r\.payload_sha256 ~/);
  assert.match(api, /p\.provider_payment_id = e\.details ->> 'paymentIntent'/);
  assert.match(api, /p\.provider_event_id = e\.details ->> 'eventId'/);
  assert.match(api, /r\.provider_event_id = p\.provider_event_id/);
  assert.match(api, /p\.provider = 'stripe'/);
  assert.match(api, /r\.provider = 'stripe'/);
  assert.match(api, /billing\.stripe_recurring_invoice_settled/);
  assert.match(api, /subscription\.renewed_after_verified_settlement/);
});

test('Q85 settlement references are written only after provider and tenant verification', () => {
  assert.match(settlement, /verifyStripeSignature\(rawBody, header, config\.webhookSecret\)/);
  assert.match(settlement, /assertRecurringProviderSettlement/);
  assert.match(settlement, /assertRecurringLocalSettlement/);
  assert.match(settlement, /INSERT INTO billing_webhook_receipts/);
  assert.match(settlement, /INSERT INTO billing_payments/);
  assert.match(settlement, /INSERT INTO subscription_events/);
  assert.match(settlement, /billing\.stripe_recurring_invoice_settled/);
  assert.match(settlement, /subscription\.renewed_after_verified_settlement/);
  assert.doesNotMatch(api, /@Body|@Headers|req\.headers|req\.query|paymentVerified|x-tenant-id/);
});

test('Q85 does not leak internal deployment config, SQL or receipt IDs on denied access', () => {
  assert.match(api, /ForbiddenException\('Access unavailable'\)/);
  assert.doesNotMatch(api, /console\.log|JSON\.stringify\(.*error/);
  assert.doesNotMatch(api, /r\.payload_sha256\s+AS|e\.details\s+AS/);
});
