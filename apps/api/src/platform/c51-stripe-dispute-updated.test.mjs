import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseStripePaymentException, shouldPauseOnPaymentException,
  verifyStripeSignature } from './stripe-policy.ts';
import { assertRecurringReversalProvider } from './stripe-recurring-reversal.ts';

// C51: synthetic Stripe TEST data only; no provider calls or paid activation.
const tenantId = '11111111-1111-4111-8111-111111111111';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const invoiceId = '44444444-4444-4444-8444-444444444444';
const end = 1796083200;
const ledger = { tenantId, subscriptionId, planId, invoiceId,
  stripeSubscriptionId: 'sub_C51', stripeCustomerId: 'cus_C51',
  stripePriceId: 'price_C51', stripeInvoiceId: 'in_C51',
  paymentIntentId: 'pi_C51', amountMinor: 12000, currency: 'SAR',
  periodEndsAt: new Date(end * 1000).toISOString() };
const intent = { object: 'payment_intent', id: 'pi_C51', livemode: false,
  status: 'succeeded', amount: 12000, amount_received: 12000,
  currency: 'sar', customer: 'cus_C51', invoice: 'in_C51',
  latest_charge: 'ch_C51' };
const invoice = { object: 'invoice', id: 'in_C51', livemode: false,
  status: 'paid', paid: true, collection_method: 'charge_automatically',
  billing_reason: 'subscription_cycle', subscription: 'sub_C51',
  customer: 'cus_C51', payment_intent: 'pi_C51',
  amount_due: 12000, amount_paid: 12000, amount_remaining: 0,
  total: 12000, currency: 'sar',
  lines: { data: [{ price: { id: 'price_C51' }, amount: 12000,
    quantity: 1, type: 'subscription', period: { end } }],
    has_more: false, total_count: 1 } };
const subscription = { object: 'subscription', id: 'sub_C51', livemode: false,
  customer: 'cus_C51', status: 'active', metadata: { tenantId, planId } };
const charge = { object: 'charge', id: 'ch_C51', livemode: false,
  payment_intent: 'pi_C51', amount: 12000, amount_refunded: 0,
  currency: 'sar', paid: true, captured: true, customer: 'cus_C51' };
const dispute = { object: 'dispute', id: 'dp_C51', livemode: false,
  payment_intent: 'pi_C51', charge: 'ch_C51', amount: 12000,
  currency: 'sar', status: 'needs_response' };
const signed = (status, eventId = 'evt_C51') =>
  Buffer.from(JSON.stringify({ id: eventId, type: 'charge.dispute.updated',
    livemode: false, data: { object: { ...dispute, status } } }));
const verify = (event, providerDispute, sub = subscription, l = ledger) =>
  assertRecurringReversalProvider(event, intent, invoice, sub, charge,
    providerDispute, l, false);
const pause = (verified, local = { id: subscriptionId, status: 'active',
  periodEndsAt: ledger.periodEndsAt }, latest = subscriptionId) =>
  shouldPauseOnPaymentException(verified.type === 'dispute_closed' &&
    verified.chargebackLost === true ? 'dispute_opened' : verified.type,
  local, { subscriptionId, periodEndsAt: ledger.periodEndsAt },
  latest, new Date('2026-11-15T00:00:00Z'));

test('C51 signed TEST dispute.updated open independently pauses only current period', () => {
  const raw = signed('under_review');
  const secret = 'whsec_12345678901234567890123456789012';
  const at = 1793491200;
  const mac = createHmac('sha256', secret).update(String(at))
    .update('.').update(raw).digest('hex');
  assert.equal(verifyStripeSignature(raw, 't=' + at + ',v1=' + mac,
    secret, at * 1000), true);
  const event = parseStripePaymentException(raw, false);
  assert.equal(event.type, 'dispute_opened');
  const verified = verify(event, { ...dispute, status: 'under_review' });
  assert.equal(verified.type, 'dispute_opened');
  assert.equal(pause(verified), true);
  assert.equal(pause(verified, { id: subscriptionId, status: 'active',
    periodEndsAt: '2027-01-01T00:00:00Z' }), false);
  assert.equal(pause(verified, undefined, planId), false);
});

test('C51 terminal updated LOST revokes; WON and warning-closed never grant', () => {
  for (const status of ['lost', 'won', 'warning_closed']) {
    const event = parseStripePaymentException(signed(status), false);
    assert.equal(event.type, 'dispute_closed');
    const verified = verify(event, { ...dispute, status });
    assert.equal(verified.type, 'dispute_closed');
    assert.equal(verified.chargebackLost === true, status === 'lost');
    assert.equal(pause(verified), status === 'lost');
  }
  const event = parseStripePaymentException(signed('needs_response'), false);
  const delayedLost = verify(event, { ...dispute, status: 'lost' });
  assert.equal(delayedLost.chargebackLost, true);
  assert.equal(pause(delayedLost), true);
});

test('C51 invalid signed updates, LIVE and provider/tenant mismatches fail closed', () => {
  for (const status of ['unknown', 'canceled', '', null]) {
    assert.throws(() => parseStripePaymentException(signed(status), false));
  }
  assert.throws(() => parseStripePaymentException(signed('lost'), true));
  const event = parseStripePaymentException(signed('lost'), false);
  assert.throws(() => verify(event, { ...dispute, status: 'under_review' }));
  assert.throws(() => verify(event, { ...dispute, charge: 'ch_Other' }));
  assert.throws(() => verify(event, { ...dispute, payment_intent: 'pi_Other' }));
  assert.throws(() => verify(event, { ...dispute, livemode: true }));
  assert.throws(() => verify(event, { ...dispute, status: 'lost' },
    { ...subscription, metadata: { tenantId: planId, planId } }));
  assert.throws(() => verify(event, { ...dispute, status: 'lost' },
    subscription, { ...ledger, tenantId: planId }));
});

test('C51 signed updated events use locked replay-safe recurring handler, no grant', () => {
  const source = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const policy = readFileSync(new URL('./stripe-policy.ts', import.meta.url), 'utf8');
  const webhook = source.slice(source.indexOf('async webhook('));
  const method = source.slice(source.indexOf('private async recordRecurringPaymentException('),
    source.indexOf('private async handlePaymentException('));
  assert.match(policy, /'charge\\.dispute\\.updated'/);
  assert.ok(webhook.indexOf('verifyStripeSignature(rawBody, header') <
    webhook.indexOf('parseStripePaymentException(rawBody, config.liveMode)'));
  assert.match(webhook, /if \\(exceptionEvent\\) return this\\.handlePaymentException/);
  assert.match(method, /config\\.liveMode \\|\\| process\\.env\\.DEPLOYMENT_ENV === 'production'/);
  assert.match(method, /pg_advisory_xact_lock/);
  assert.match(method, /FOR UPDATE OF b, s, i, pay/);
  assert.match(method, /assertRecurringReversalProvider/);
  assert.match(method, /existing\\.digest !== digest/);
  assert.match(method, /prior\\.providerObjectId !== event\\.providerObjectId/);
  assert.match(method, /UPDATE tenant_subscriptions SET status = 'paused'/);
  assert.doesNotMatch(method, /INSERT INTO billing_payments|SET status = 'active'/);
});
