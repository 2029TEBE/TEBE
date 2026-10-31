import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { verifyStripeSignature } from './stripe-policy.ts';
import { parseRecurringSuspension, assertRecurringSuspensionProvider,
  recurringSuspensionTransition } from './stripe-recurring-suspension.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const ledger = { tenantId, subscriptionId, planId,
  stripeSubscriptionId: 'sub_C39', stripeCustomerId: 'cus_C39',
  stripePriceId: 'price_C39', bindingStatus: 'active',
  localStatus: 'active', localPeriodEndsAt: '2026-12-01T00:00:00Z' };
const provider = { object: 'subscription', id: 'sub_C39', livemode: false,
  status: 'paused', customer: 'cus_C39', metadata: { tenantId, planId },
  items: { data: [{ price: { id: 'price_C39' }, quantity: 1 }], has_more: false } };
const signed = (type, sub = provider, eventId = 'evt_C39') =>
  Buffer.from(JSON.stringify({ id: eventId, type, livemode: false, data: { object: sub } }));
const paused = parseRecurringSuspension(signed('customer.subscription.paused'), false);

test('C39: signed TEST paused event requires HMAC, provider GET and tenant binding', () => {
  const raw = signed('customer.subscription.paused');
  const secret = 'whsec_12345678901234567890123456789012';
  const timestamp = 1793491200;
  const signature = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest('hex');
  const header = `t=${timestamp},v1=${signature}`;
  assert.equal(verifyStripeSignature(raw, header, secret, timestamp * 1000), true);
  assert.equal(verifyStripeSignature(Buffer.concat([raw, Buffer.from(' ')]),
    header, secret, timestamp * 1000), false);
  assert.equal(paused.providerStatus, 'paused');
  assert.doesNotThrow(() => assertRecurringSuspensionProvider(paused, provider, ledger, subscriptionId, false));
  assert.equal(recurringSuspensionTransition(paused, ledger), 'paused');
  assert.equal(recurringSuspensionTransition(paused, { ...ledger, localStatus: 'paused' }), null);
});

test('C39: unpaid event preserves paid access until expiry, then marks past_due', () => {
  const unpaidProvider = { ...provider, status: 'unpaid' };
  const candidate = parseRecurringSuspension(signed('customer.subscription.updated', unpaidProvider), false);
  assert.doesNotThrow(() => assertRecurringSuspensionProvider(candidate, unpaidProvider, ledger, subscriptionId, false));
  assert.equal(recurringSuspensionTransition(candidate, ledger, Date.parse('2026-11-15T00:00:00Z')), null);
  assert.equal(recurringSuspensionTransition(candidate, ledger, Date.parse('2026-12-02T00:00:00Z')), 'past_due');
  assert.equal(recurringSuspensionTransition(candidate, { ...ledger, localStatus: 'paused' }, Date.parse('2026-12-02T00:00:00Z')), null);
  assert.equal(parseRecurringSuspension(signed('customer.subscription.updated', { ...provider, status: 'active' }), false), null);
});

test('C39: LIVE, foreign tenant, changed price, stale and malformed events fail closed', () => {
  assert.throws(() => parseRecurringSuspension(signed('customer.subscription.paused', { ...provider, livemode: true }), false));
  assert.throws(() => parseRecurringSuspension(signed('customer.subscription.paused'), true));
  assert.throws(() => parseRecurringSuspension(signed('customer.subscription.paused', { ...provider, status: 'active' }), false));
  assert.throws(() => parseRecurringSuspension(Buffer.from('{'), false));
  for (const bad of [
    { ...provider, metadata: { tenantId: planId, planId } },
    { ...provider, customer: 'cus_FOREIGN' },
    { ...provider, items: { data: [{ price: 'price_FOREIGN', quantity: 1 }] } },
    { ...provider, items: { ...provider.items, has_more: true } },
    { ...provider, status: 'active' }, { ...provider, livemode: true },
  ]) assert.throws(() => assertRecurringSuspensionProvider(paused, bad, ledger, subscriptionId, false));
  for (const bad of [
    { ...ledger, tenantId: planId }, { ...ledger, planId: tenantId },
    { ...ledger, localStatus: 'canceled' }, { ...ledger, bindingStatus: 'canceled' },
  ]) assert.throws(() => assertRecurringSuspensionProvider(paused, provider, bad, subscriptionId, false));
  assert.throws(() => assertRecurringSuspensionProvider(paused, provider, ledger, tenantId, false));
  assert.throws(() => assertRecurringSuspensionProvider(paused, provider, ledger, subscriptionId, true));
});

test('C39: webhook wiring is signature-first, tenant-locked, replay-safe, non-granting', () => {
  const src = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const webhook = src.slice(src.indexOf('async webhook('));
  assert.ok(webhook.indexOf('verifyStripeSignature(rawBody, header') <
    webhook.indexOf('parseRecurringSuspension(rawBody, config.liveMode)'));
  assert.ok(webhook.indexOf('parseRecurringSuspension(rawBody, config.liveMode)') <
    webhook.indexOf('parseRecurringCancellation(rawBody, config.liveMode)'));
  const method = src.slice(src.indexOf('private async recordRecurringSuspension('),
    src.indexOf('private async recordRecurringCancellation('));
  assert.match(method, /config\\.liveMode \\|\\| process\\.env\\.DEPLOYMENT_ENV === 'production'/);
  assert.match(method, /withTenant\\(tenantId, async tx =>/);
  assert.match(method, /pg_advisory_xact_lock/);
  assert.match(method, /FOR UPDATE OF b, s/);
  assert.match(method, /assertRecurringSuspensionProvider/);
  assert.match(method, /recurringSuspensionTransition/);
  assert.match(method, /payloadSha256/);
  assert.doesNotMatch(method, /INSERT INTO billing_payments|INSERT INTO billing_invoices|SET status = 'active'/);
});
