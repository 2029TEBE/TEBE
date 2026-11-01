import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseStripePaymentException, shouldPauseOnPaymentException, verifyStripeSignature } from './stripe-policy.ts';
import { assertRecurringReversalProvider } from './stripe-recurring-reversal.ts';

// C49: a signed dispute.created can arrive after Stripe's dispute is closed.
// Synthetic-only identities and funds; no Stripe calls or customer data.
const tenantId = '11111111-1111-4111-8111-111111111111';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const invoiceId = '44444444-4444-4444-8444-444444444444';
const end = 1796083200;
const ledger = { tenantId, subscriptionId, planId, invoiceId,
  stripeSubscriptionId: 'sub_C49', stripeCustomerId: 'cus_C49',
  stripePriceId: 'price_C49', stripeInvoiceId: 'in_C49',
  paymentIntentId: 'pi_C49', amountMinor: 12000, currency: 'SAR',
  periodEndsAt: new Date(end * 1000).toISOString() };
const intent = { object: 'payment_intent', id: 'pi_C49', livemode: false,
  status: 'succeeded', amount: 12000, amount_received: 12000,
  currency: 'sar', customer: 'cus_C49', invoice: 'in_C49', latest_charge: 'ch_C49' };
const invoice = { object: 'invoice', id: 'in_C49', livemode: false,
  status: 'paid', paid: true, collection_method: 'charge_automatically',
  billing_reason: 'subscription_cycle', subscription: 'sub_C49',
  customer: 'cus_C49', payment_intent: 'pi_C49',
  amount_due: 12000, amount_paid: 12000, amount_remaining: 0, total: 12000,
  currency: 'sar', lines: { data: [{ price: { id: 'price_C49' }, amount: 12000,
    quantity: 1, type: 'subscription', period: { start: 1793491200, end } }],
    has_more: false, total_count: 1 } };
const subscription = { object: 'subscription', id: 'sub_C49', livemode: false,
  customer: 'cus_C49', status: 'active', metadata: { tenantId, planId } };
const charge = { object: 'charge', id: 'ch_C49', livemode: false,
  payment_intent: 'pi_C49', amount: 12000, amount_refunded: 0,
  currency: 'sar', paid: true, captured: true, customer: 'cus_C49' };
const openDispute = { object: 'dispute', id: 'dp_C49', livemode: false,
  payment_intent: 'pi_C49', charge: 'ch_C49', amount: 12000,
  currency: 'sar', status: 'needs_response' };
const signed = (type, object, id = 'evt_C49') => Buffer.from(JSON.stringify({
  id, type, livemode: false, data: { object },
}));
const opened = parseStripePaymentException(signed('charge.dispute.created', openDispute), false);
const verify = (provider = openDispute, event = opened, i = intent,
  inv = invoice, sub = subscription, ch = charge, l = ledger, live = false) =>
  assertRecurringReversalProvider(event, i, inv, sub, ch, provider, l, live);

test('C49: HMAC-verified TEST created dispute resolves active provider state', () => {
  const raw = signed('charge.dispute.created', openDispute);
  const secret = 'whsec_12345678901234567890123456789012';
  const at = 1793491200;
  const mac = createHmac('sha256', secret).update(String(at))
    .update('.').update(raw).digest('hex');
  assert.equal(verifyStripeSignature(raw, 't=' + at + ',v1=' + mac,
    secret, at * 1000), true);
  assert.deepEqual(verify(), { type: 'dispute_opened', amountMinor: 12000 });
});

test('C49: late created event reconciles independently LOST dispute as terminal', () => {
  const result = verify({ ...openDispute, status: 'lost' });
  assert.deepEqual(result, { type: 'dispute_closed', amountMinor: 12000,
    chargebackLost: true });
  const accessLossType = result.type === 'dispute_closed' && result.chargebackLost
    ? 'dispute_opened' : result.type;
  const local = { id: subscriptionId, status: 'active',
    periodEndsAt: ledger.periodEndsAt };
  const period = { subscriptionId, periodEndsAt: ledger.periodEndsAt };
  const now = new Date('2026-11-15T00:00:00.000Z');
  assert.equal(shouldPauseOnPaymentException(accessLossType, local,
    period, subscriptionId, now), true);
  assert.equal(shouldPauseOnPaymentException(accessLossType, local,
    period, planId, now), false);
  assert.equal(shouldPauseOnPaymentException(accessLossType,
    { ...local, periodEndsAt: '2027-01-01T00:00:00Z' },
    period, subscriptionId, now), false);
});

test('C49: late created event after WON or warning-closed does not block access', () => {
  for (const status of ['won', 'warning_closed']) {
    const result = verify({ ...openDispute, status });
    assert.deepEqual(result, { type: 'dispute_closed', amountMinor: 12000 });
    assert.equal(shouldPauseOnPaymentException(result.type,
      { id: subscriptionId, status: 'active', periodEndsAt: ledger.periodEndsAt },
      { subscriptionId, periodEndsAt: ledger.periodEndsAt },
      subscriptionId, new Date('2026-11-15T00:00:00Z')), false);
  }
});

test('C49: closed event cannot be trusted against still-open provider dispute', () => {
  const closed = parseStripePaymentException(signed('charge.dispute.closed',
    { ...openDispute, status: 'lost' }), false);
  assert.throws(() => verify(openDispute, closed));
  assert.deepEqual(verify({ ...openDispute, status: 'lost' }, closed),
    { type: 'dispute_closed', amountMinor: 12000, chargebackLost: true });
  assert.throws(() => verify({ ...openDispute, status: 'unknown' }));
});

test('C49: terminal reconciliation rejects cross-tenant, forged funds and LIVE', () => {
  const lost = { ...openDispute, status: 'lost' };
  assert.throws(() => verify(lost, opened, intent, invoice,
    { ...subscription, metadata: { tenantId: planId, planId } }));
  assert.throws(() => verify(lost, opened, intent, invoice, subscription,
    charge, { ...ledger, tenantId: planId }));
  assert.throws(() => verify({ ...lost, charge: 'ch_FOREIGN' }));
  assert.throws(() => verify({ ...lost, payment_intent: 'pi_FOREIGN' }));
  assert.throws(() => verify(lost, opened, { ...intent, livemode: true }));
  assert.throws(() => verify(lost, opened, intent, invoice, subscription,
    charge, ledger, true));
});

test('C49: tenant locks, signed type, replay digest and no-grant remain wired', () => {
  const src = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const method = src.slice(src.indexOf('private async recordRecurringPaymentException('),
    src.indexOf('private async handlePaymentException('));
  const webhook = src.slice(src.indexOf('async webhook('));
  assert.ok(webhook.indexOf('verifyStripeSignature(rawBody, header') <
    webhook.indexOf('parseStripePaymentException(rawBody, config.liveMode)'));
  assert.match(method, /pg_advisory_xact_lock/);
  assert.match(method, /FOR UPDATE OF b, s, i, pay/);
  assert.match(method, /existing\.digest !== digest/);
  assert.match(method, /provider_event_id = \$\{event\.eventId\}/);
  assert.match(method, /signedType: event\.type/);
  assert.match(method, /verified\.type === 'dispute_closed' && verified\.chargebackLost === true/);
  assert.match(method, /UPDATE tenant_subscriptions SET status = 'paused'/);
  assert.doesNotMatch(method, /INSERT INTO billing_payments|SET status = 'active'/);
});
