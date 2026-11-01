import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseStripePaymentException, shouldPauseOnPaymentException,
  verifyStripeSignature } from './stripe-policy.ts';
import { assertRecurringReversalProvider } from './stripe-recurring-reversal.ts';

// C50: synthetic Stripe TEST identities only. No provider calls, credentials,
// customer data or entitlement-grant route.
const tenantId = '11111111-1111-4111-8111-111111111111';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const invoiceId = '44444444-4444-4444-8444-444444444444';
const end = 1796083200;
const ledger = { tenantId, subscriptionId, planId, invoiceId,
  stripeSubscriptionId: 'sub_C50', stripeCustomerId: 'cus_C50',
  stripePriceId: 'price_C50', stripeInvoiceId: 'in_C50',
  paymentIntentId: 'pi_C50', amountMinor: 12000, currency: 'SAR',
  periodEndsAt: new Date(end * 1000).toISOString() };
const intent = { object: 'payment_intent', id: 'pi_C50', livemode: false,
  status: 'succeeded', amount: 12000, amount_received: 12000,
  currency: 'sar', customer: 'cus_C50', invoice: 'in_C50',
  latest_charge: 'ch_C50' };
const invoice = { object: 'invoice', id: 'in_C50', livemode: false,
  status: 'paid', paid: true, collection_method: 'charge_automatically',
  billing_reason: 'subscription_cycle', subscription: 'sub_C50',
  customer: 'cus_C50', payment_intent: 'pi_C50',
  amount_due: 12000, amount_paid: 12000, amount_remaining: 0,
  total: 12000, currency: 'sar',
  lines: { data: [{ price: { id: 'price_C50' }, amount: 12000,
    quantity: 1, type: 'subscription', period: { end } }],
    has_more: false, total_count: 1 } };
const subscription = { object: 'subscription', id: 'sub_C50', livemode: false,
  customer: 'cus_C50', status: 'active', metadata: { tenantId, planId } };
const charge = { object: 'charge', id: 'ch_C50', livemode: false,
  payment_intent: 'pi_C50', amount: 12000, amount_refunded: 4000,
  currency: 'sar', paid: true, captured: true, customer: 'cus_C50' };
const dispute = { object: 'dispute', id: 'dp_C50', livemode: false,
  payment_intent: 'pi_C50', charge: 'ch_C50', amount: 12000,
  currency: 'sar', status: 'needs_response' };
const signed = (type, object, eventId = 'evt_C50') =>
  Buffer.from(JSON.stringify({ id: eventId, type, livemode: false,
    data: { object } }));
const verify = (event, ch = charge, dp = null, sub = subscription,
  l = ledger, live = false) =>
  assertRecurringReversalProvider(event, intent, invoice, sub, ch, dp, l, live);
const current = { id: subscriptionId, status: 'active',
  periodEndsAt: ledger.periodEndsAt };
const period = { subscriptionId, periodEndsAt: ledger.periodEndsAt };
const now = new Date('2026-11-15T00:00:00.000Z');
const pause = (result, local = current, latest = subscriptionId) =>
  shouldPauseOnPaymentException(result.type === 'dispute_closed' &&
    result.chargebackLost === true ? 'dispute_opened' : result.type,
  local, period, latest, now);

test('C50 signed partial refund replay sees provider cumulative FULL refund', () => {
  const raw = signed('charge.refunded', charge);
  const secret = 'whsec_12345678901234567890123456789012';
  const at = 1793491200;
  const mac = createHmac('sha256', secret).update(String(at))
    .update('.').update(raw).digest('hex');
  assert.equal(verifyStripeSignature(raw, 't=' + at + ',v1=' + mac,
    secret, at * 1000), true);
  const event = parseStripePaymentException(raw, false);
  const first = verify(event);
  assert.deepEqual(first, { type: 'partial_refund', amountMinor: 4000 });
  assert.equal(pause(first), false);
  const full = verify(event, { ...charge, amount_refunded: 12000 });
  assert.deepEqual(full, { type: 'full_refund', amountMinor: 12000 });
  assert.equal(pause(full), true);
});

test('C50 signed dispute replay independently escalates terminal LOST only', () => {
  const raw = signed('charge.dispute.created', dispute);
  const event = parseStripePaymentException(raw, false);
  const first = verify(event, charge, dispute);
  assert.equal(first.type, 'dispute_opened');
  const lost = verify(event, charge, { ...dispute, status: 'lost' });
  assert.deepEqual(lost, { type: 'dispute_closed', amountMinor: 12000,
    chargebackLost: true });
  assert.equal(pause(lost), true);
  for (const status of ['won', 'warning_closed']) {
    const result = verify(event, charge, { ...dispute, status });
    assert.equal(result.chargebackLost, undefined);
    assert.equal(pause(result), false);
  }
});

test('C50 historical renewal and cross-tenant replay cannot revoke newer access', () => {
  const event = parseStripePaymentException(signed('charge.refunded', charge), false);
  const full = verify(event, { ...charge, amount_refunded: 12000 });
  assert.equal(pause(full, { ...current, periodEndsAt: '2027-01-01T00:00:00Z' }), false);
  assert.equal(pause(full, current, planId), false);
  assert.equal(pause(full, { ...current, status: 'paused' }), false);
  assert.throws(() => verify(event, { ...charge, amount_refunded: 12000 },
    null, { ...subscription, metadata: { tenantId: planId, planId } }));
  assert.throws(() => verify(event, { ...charge, amount_refunded: 12000 },
    null, subscription, { ...ledger, tenantId: planId }));
  assert.throws(() => verify(event, { ...charge, amount_refunded: 12000 },
    null, subscription, ledger, true));
});

test('C50 locked replay checks receipt, original exception and audit atomically', () => {
  const source = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const method = source.slice(source.indexOf('private async recordRecurringPaymentException('),
    source.indexOf('private async handlePaymentException('));
  const webhook = source.slice(source.indexOf('async webhook('));
  assert.ok(webhook.indexOf('verifyStripeSignature(rawBody, header') <
    webhook.indexOf('parseStripePaymentException(rawBody, config.liveMode)'));
  assert.match(method, /config\.liveMode \|\| process\.env\.DEPLOYMENT_ENV === 'production'/);
  assert.match(method, /pg_advisory_xact_lock/);
  assert.match(method, /FOR UPDATE OF b, s, i, pay/);
  assert.match(method, /assertRecurringReversalProvider/);
  assert.match(method, /existing\.digest !== digest/);
  assert.match(method, /prior\.providerObjectId !== event\.providerObjectId/);
  assert.match(method, /prior\.signedType !== event\.type/);
  assert.match(method, /FOR UPDATE\`\)\)\[0\]/);
  assert.match(method, /UPDATE billing_payment_exceptions SET subscription_paused = true/);
  assert.match(method, /billing\.stripe_recurring_reversal_replay_escalated/);
  assert.match(method, /UPDATE tenant_subscriptions SET status = 'paused'/);
  assert.match(method, /replayReconciled: true/);
  assert.doesNotMatch(method, /INSERT INTO billing_payments|SET status = 'active'/);
});
