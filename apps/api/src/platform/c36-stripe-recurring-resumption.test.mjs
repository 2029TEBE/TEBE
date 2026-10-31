import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { verifyStripeSignature } from './stripe-policy.ts';
import { parseRecurringResumption, assertRecurringResumptionProvider } from './stripe-recurring-resumption.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const periodEnd = '2030-01-01T00:00:00.000Z';
const periodSeconds = Date.parse(periodEnd) / 1000;
const provider = {
  object: 'subscription', id: 'sub_C36ABC', customer: 'cus_C36ABC',
  livemode: false, status: 'active', cancel_at_period_end: false,
  latest_invoice: 'in_C36PAID', current_period_end: periodSeconds,
  metadata: { tenantId, planId },
  items: { data: [{ price: { id: 'price_C36ABC' }, quantity: 1,
    current_period_end: periodSeconds }], has_more: false, total_count: 1 },
};
const ledger = {
  tenantId, subscriptionId, planId,
  stripeSubscriptionId: provider.id, stripeCustomerId: provider.customer,
  stripePriceId: 'price_C36ABC', bindingStatus: 'active',
  bindingCancelAtPeriodEnd: true, bindingLastPeriodEndsAt: periodEnd,
  localStatus: 'active', localCancelAtPeriodEnd: true,
  localPeriodEndsAt: periodEnd, settledStripeInvoiceId: 'in_C36PAID',
  settledInvoiceStatus: 'paid', settledPeriodEndsAt: periodEnd,
  hasBlockingReversal: false,
};
const signed = (sub = provider, previous = true, eventId = 'evt_C36ABC') =>
  Buffer.from(JSON.stringify({
    id: eventId, type: 'customer.subscription.updated', livemode: false,
    data: { object: sub, previous_attributes: { cancel_at_period_end: previous } },
  }));
const candidate = parseRecurringResumption(signed(), false);
const verify = (p = provider, l = ledger, latest = subscriptionId, mode = false) =>
  assertRecurringResumptionProvider(candidate, p, l, latest, mode,
    Date.parse('2029-12-01T00:00:00Z'));

test('signature-first TEST resumption verifies only a genuine cancel flag transition', () => {
  const raw = signed();
  const secret = 'whsec_12345678901234567890123456789012';
  const t = 1793491200;
  const mac = createHmac('sha256', secret)
    .update(String(t)).update('.').update(raw).digest('hex');
  assert.equal(verifyStripeSignature(raw, 't=' + t + ',v1=' + mac,
    secret, t * 1000), true);
  assert.deepEqual(candidate, {
    eventId: 'evt_C36ABC', stripeSubscriptionId: provider.id,
    customerId: provider.customer, tenantId, planId,
  });
  assert.doesNotThrow(() => verify());
  assert.equal(parseRecurringResumption(signed(provider, false), false), null);
  assert.equal(parseRecurringResumption(signed({
    ...provider, cancel_at_period_end: true,
  }), false), null);
});

test('reject live-mode, forged or malformed signed transition', () => {
  assert.throws(() => parseRecurringResumption(signed(), true));
  assert.throws(() => parseRecurringResumption(Buffer.from('{'), false));
  for (const p of [
    { ...provider, livemode: true },
    { ...provider, status: 'past_due' },
    { ...provider, customer: 'bad' },
    { ...provider, metadata: { tenantId: 'bad', planId } },
    { ...provider, id: 'bad' },
  ]) assert.throws(() => parseRecurringResumption(signed(p), false));
  assert.throws(() => parseRecurringResumption(signed(provider, true, 'bad'), false));
});

test('cross-tenant, stale and refunded local entitlements never resume', () => {
  for (const l of [
    { ...ledger, tenantId: planId },
    { ...ledger, planId: tenantId },
    { ...ledger, bindingStatus: 'pending' },
    { ...ledger, bindingCancelAtPeriodEnd: false },
    { ...ledger, localCancelAtPeriodEnd: false },
    { ...ledger, localStatus: 'paused' },
    { ...ledger, localStatus: 'canceled' },
    { ...ledger, settledInvoiceStatus: 'open' },
    { ...ledger, settledStripeInvoiceId: 'in_OTHER' },
    { ...ledger, bindingLastPeriodEndsAt: '2029-01-01T00:00:00Z' },
    { ...ledger, settledPeriodEndsAt: '2029-01-01T00:00:00Z' },
    { ...ledger, hasBlockingReversal: true },
  ]) assert.throws(() => verify(provider, l));
  assert.throws(() => verify(provider, ledger, planId));
  assert.throws(() => verify(provider, ledger, subscriptionId, true));
  assert.throws(() => assertRecurringResumptionProvider(candidate, provider,
    ledger, subscriptionId, false, Date.parse('2030-02-01T00:00:00Z')));
});

test('provider GET must match tenant, price, invoice and unexpired service period', () => {
  for (const p of [
    { ...provider, livemode: true },
    { ...provider, status: 'canceled' },
    { ...provider, cancel_at_period_end: true },
    { ...provider, customer: 'cus_OTHER' },
    { ...provider, latest_invoice: 'in_UNPAID' },
    { ...provider, metadata: { tenantId: planId, planId } },
    { ...provider, current_period_end: periodSeconds + 86400 },
    { ...provider, items: { ...provider.items, has_more: true } },
    { ...provider, items: { ...provider.items, total_count: 2 } },
    { ...provider, items: { data: [...provider.items.data, ...provider.items.data] } },
    { ...provider, items: { data: [{ price: 'price_OTHER', quantity: 1,
      current_period_end: periodSeconds }] } },
    { ...provider, items: { data: [{ price: 'price_C36ABC', quantity: 2,
      current_period_end: periodSeconds }] } },
  ]) assert.throws(() => verify(p));
  assert.throws(() => verify({
    ...provider, current_period_end: undefined,
    items: { ...provider.items, data: [{ ...provider.items.data[0],
      current_period_end: undefined }] },
  }));
});

test('service is HMAC-first, TEST-only, tenant-locked and never grants a period', () => {
  const src = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const webhook = src.slice(src.indexOf('async webhook('));
  const method = src.slice(src.indexOf('private async recordRecurringResumption('),
    src.indexOf('private async settleRecurringInvoice('));
  assert.ok(webhook.indexOf('verifyStripeSignature(rawBody, header') <
    webhook.indexOf('parseRecurringResumption(rawBody, config.liveMode)'));
  assert.match(webhook, /return this\.recordRecurringResumption\(resumption, sha256\(rawBody\), config\)/);
  assert.match(method, /config\.liveMode \|\| process\.env\.DEPLOYMENT_ENV === 'production'/);
  assert.match(method, /withTenant\(tenantId, async tx =>/);
  assert.match(method, /pg_advisory_xact_lock/);
  assert.match(method, /FOR UPDATE OF b, s/);
  assert.match(method, /assertRecurringResumptionProvider/);
  assert.match(method, /hasBlockingReversal/);
  assert.match(method, /payloadSha256/);
  assert.match(method, /UPDATE billing_stripe_recurring_bindings/);
  assert.match(method, /UPDATE tenant_subscriptions/);
  assert.doesNotMatch(method, /SET status = 'active'|INSERT INTO billing_payments|SET period_ends_at =/);
});
