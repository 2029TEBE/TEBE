import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertRecurringLocalSettlement } from './stripe-recurring-local-settlement.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const oldEnd = '2026-11-01T00:00:00.000Z';
const newEnd = '2026-12-01T00:00:00.000Z';
const now = Date.parse('2026-11-02T00:00:00.000Z');
const binding = { tenantId, subscriptionId, planId,
  stripeSubscriptionId: 'sub_C37', stripeCustomerId: 'cus_C37',
  stripePriceId: 'price_C37', status: 'active',
  lastPeriodEndsAt: oldEnd, cancelAtPeriodEnd: false };
const local = { id: subscriptionId, planId, status: 'past_due',
  cancelAtPeriodEnd: false, periodStartsAt: '2026-10-01T00:00:00.000Z',
  periodEndsAt: oldEnd };
const paid = { tenantId, subscriptionId, planId,
  stripeSubscriptionId: 'sub_C37', stripeInvoiceId: 'in_C37',
  paymentIntentId: 'pi_C37', eventId: 'evt_C37',
  amountMinor: 12000, currency: 'SAR',
  periodStartsAt: oldEnd, periodEndsAt: newEnd };
const check = (b = binding, l = local, v = paid,
  latest = subscriptionId, at = now, failedReceipt = true) =>
  assertRecurringLocalSettlement(b, l, v, latest, at, failedReceipt);

test('C37: late paid renewal recovers expired C34 past_due only with matching failure receipt', () => {
  assert.doesNotThrow(() => check());
  assert.throws(() => check(binding, local, paid, subscriptionId, now, false));
  assert.throws(() => check(binding, local, paid, subscriptionId, now, undefined));
  assert.throws(() => check(binding, local, paid, subscriptionId,
    Date.parse('2026-10-31T00:00:00Z')));
});

test('C37: wrong tenant, plan, subscription or provider binding cannot restore access', () => {
  for (const v of [
    { ...paid, tenantId: planId }, { ...paid, planId: tenantId },
    { ...paid, subscriptionId: tenantId },
    { ...paid, stripeSubscriptionId: 'sub_FOREIGN' },
  ]) assert.throws(() => check(binding, local, v));
  assert.throws(() => check(binding, local, paid, tenantId));
  assert.throws(() => check(binding, { ...local, id: tenantId }));
  assert.throws(() => check(binding, { ...local, planId: tenantId }));
});

test('C37: canceled, paused, backdated, noncontiguous and expired periods fail closed', () => {
  for (const b of [
    { ...binding, cancelAtPeriodEnd: true },
    { ...binding, lastPeriodEndsAt: '2026-10-31T00:00:00Z' },
    { ...binding, status: 'pending' },
  ]) assert.throws(() => check(b));
  for (const l of [
    { ...local, status: 'paused' }, { ...local, status: 'canceled' },
    { ...local, cancelAtPeriodEnd: true },
    { ...local, periodEndsAt: '2026-10-31T00:00:00Z' },
  ]) assert.throws(() => check(binding, l));
  assert.throws(() => check(binding, local,
    { ...paid, periodStartsAt: '2026-11-02T00:00:00Z' }));
  assert.throws(() => check(binding, local, paid, subscriptionId,
    Date.parse('2026-12-02T00:00:00Z')));
});

test('C37: original active renewal works without a failed receipt', () => {
  assert.doesNotThrow(() => check(binding,
    { ...local, status: 'active' }, paid, subscriptionId, now, false));
});

test('C37: signed TEST settlement checks tenant-locked exact failed invoice receipt before restoration', () => {
  const source = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const method = source.slice(source.indexOf('private async settleRecurringInvoice('),
    source.indexOf('/** Stripe signs the raw request.'));
  const webhook = source.slice(source.indexOf('async webhook('));
  assert.ok(webhook.indexOf('verifyStripeSignature(rawBody, header') <
    webhook.indexOf('parsePaidRecurringInvoice(rawBody, config.liveMode)'));
  assert.match(method, /config\.liveMode \|\| process\.env\.DEPLOYMENT_ENV === 'production'/);
  assert.match(method, /withTenant\(tenantId, async tx =>/);
  assert.match(method, /pg_advisory_xact_lock/);
  assert.match(method, /FOR UPDATE OF b, s/);
  assert.match(method, /assertRecurringProviderSettlement/);
  assert.match(method, /billing\.stripe_recurring_invoice_failed/);
  assert.match(method, /details ->> 'stripeInvoiceId' = \$\{candidate\.invoiceId\}/);
  assert.match(method, /details ->> 'periodEndsAt' = \$\{verified\.periodEndsAt\}/);
  assert.match(method, /verified, latest\.id, Date\.now\(\), failedRecovery/);
  assert.match(method, /INSERT INTO billing_webhook_receipts/);
  assert.match(method, /INSERT INTO billing_payments/);
  assert.match(method, /UPDATE tenant_subscriptions/);
  assert.match(method, /UPDATE billing_stripe_recurring_bindings/);
});
