import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseStripePaymentException, shouldPauseOnPaymentException, verifyStripeSignature } from './stripe-policy.ts';
import { assertRecurringReversalProvider } from './stripe-recurring-reversal.ts';

// C48: a terminal LOST dispute must revoke an unexpired paid period even when
// dispute.created was never delivered. All identities and data are synthetic.
const tenantId = '11111111-1111-4111-8111-111111111111';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const invoiceId = '44444444-4444-4444-8444-444444444444';
const start = 1793491200, end = 1796083200;
const ledger = { tenantId, subscriptionId, planId, invoiceId,
  stripeSubscriptionId: 'sub_C48', stripeCustomerId: 'cus_C48',
  stripePriceId: 'price_C48', stripeInvoiceId: 'in_C48',
  paymentIntentId: 'pi_C48', amountMinor: 12000, currency: 'SAR',
  periodEndsAt: new Date(end * 1000).toISOString() };
const intent = { object: 'payment_intent', id: 'pi_C48', livemode: false,
  status: 'succeeded', amount: 12000, amount_received: 12000,
  currency: 'sar', customer: 'cus_C48', invoice: 'in_C48', latest_charge: 'ch_C48' };
const invoice = { object: 'invoice', id: 'in_C48', livemode: false,
  status: 'paid', paid: true, collection_method: 'charge_automatically',
  billing_reason: 'subscription_cycle', subscription: 'sub_C48',
  customer: 'cus_C48', payment_intent: 'pi_C48',
  amount_due: 12000, amount_paid: 12000, amount_remaining: 0, total: 12000,
  currency: 'sar', lines: { data: [{ price: { id: 'price_C48' }, amount: 12000,
    quantity: 1, type: 'subscription', period: { start, end } }],
    has_more: false, total_count: 1 } };
const subscription = { object: 'subscription', id: 'sub_C48', livemode: false,
  customer: 'cus_C48', status: 'active', latest_invoice: 'in_C48',
  metadata: { tenantId, planId } };
const charge = { object: 'charge', id: 'ch_C48', livemode: false,
  payment_intent: 'pi_C48', amount: 12000, amount_refunded: 0,
  currency: 'sar', paid: true, captured: true, customer: 'cus_C48' };
const dispute = { object: 'dispute', id: 'dp_C48', livemode: false,
  payment_intent: 'pi_C48', charge: 'ch_C48', amount: 12000,
  currency: 'sar', status: 'lost' };
const signed = (type, object, id = 'evt_C48') => Buffer.from(JSON.stringify({
  id, type, livemode: false, data: { object },
}));
const closed = parseStripePaymentException(signed('charge.dispute.closed', dispute), false);
const verify = (event = closed, i = intent, inv = invoice, sub = subscription,
  ch = charge, dp = dispute, l = ledger, mode = false) =>
  assertRecurringReversalProvider(event, i, inv, sub, ch, dp, l, mode);

test('C48: signed TEST lost dispute is independently verified as terminal chargeback', () => {
  const raw = signed('charge.dispute.closed', dispute);
  const secret = 'whsec_12345678901234567890123456789012';
  const at = 1793491200;
  const signature = createHmac('sha256', secret).update(String(at))
    .update('.').update(raw).digest('hex');
  assert.equal(verifyStripeSignature(raw, 't=' + at + ',v1=' + signature,
    secret, at * 1000), true);
  assert.deepEqual(verify(), { type: 'dispute_closed', amountMinor: 12000,
    chargebackLost: true });
});

test('C48: won and warning-closed disputes do not become lost chargebacks', () => {
  for (const status of ['won', 'warning_closed']) {
    const d = { ...dispute, status };
    const event = parseStripePaymentException(signed('charge.dispute.closed', d), false);
    assert.deepEqual(verify(event, intent, invoice, subscription, charge, d),
      { type: 'dispute_closed', amountMinor: 12000 });
  }
  // A delayed signed lost snapshot must not override Stripe's independently
  // retrieved current won state. The provider, not the webhook, is authoritative.
  assert.deepEqual(verify(closed, intent, invoice, subscription, charge,
    { ...dispute, status: 'won' }),
    { type: 'dispute_closed', amountMinor: 12000 });
});

test('C48: only a current, unexpired, active tenant period can be paused', () => {
  const verified = verify();
  const pauseType = verified.type === 'dispute_closed' && verified.chargebackLost === true
    ? 'dispute_opened' : verified.type;
  const local = { id: subscriptionId, status: 'active', periodEndsAt: ledger.periodEndsAt };
  const inv = { subscriptionId, periodEndsAt: ledger.periodEndsAt };
  const now = new Date('2026-11-15T00:00:00.000Z');
  assert.equal(shouldPauseOnPaymentException(pauseType, local, inv, subscriptionId, now), true);
  assert.equal(shouldPauseOnPaymentException(verified.type, local, inv, subscriptionId, now), false);
  assert.equal(shouldPauseOnPaymentException(pauseType, local, inv, planId, now), false);
  assert.equal(shouldPauseOnPaymentException(pauseType, { ...local, status: 'paused' },
    inv, subscriptionId, now), false);
  assert.equal(shouldPauseOnPaymentException(pauseType, local,
    { ...inv, periodEndsAt: '2026-10-01T00:00:00Z' }, subscriptionId, now), false);
  assert.equal(shouldPauseOnPaymentException(pauseType, local, inv, subscriptionId,
    new Date('2027-01-01T00:00:00Z')), false);
});

test('C48: cross-tenant, LIVE, identity mismatch and forged lost status fail closed', () => {
  assert.throws(() => verify(closed, intent, invoice, subscription, charge,
    dispute, { ...ledger, tenantId: planId }));
  assert.throws(() => verify(closed, intent, invoice,
    { ...subscription, metadata: { tenantId: planId, planId } }));
  assert.throws(() => verify(closed, { ...intent, latest_charge: 'ch_FOREIGN' }));
  assert.throws(() => verify(closed, intent, { ...invoice, customer: 'cus_FOREIGN' }));
  assert.throws(() => verify(closed, intent, invoice, subscription,
    { ...charge, payment_intent: 'pi_FOREIGN' }));
  assert.throws(() => verify(closed, intent, invoice, subscription, charge,
    { ...dispute, charge: 'ch_FOREIGN' }));
  assert.throws(() => verify(closed, intent, invoice, subscription, charge,
    dispute, ledger, true));
  assert.throws(() => verify(closed, intent, invoice, subscription, charge,
    { ...dispute, status: 'needs_response' }));
});

test('C48: locked webhook wiring preserves real event type, replay and no-grant barriers', () => {
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
  assert.match(method, /verified\.type === 'dispute_closed' && verified\.chargebackLost === true/);
  assert.match(method, /shouldPauseOnPaymentException\(accessLossType/);
  assert.match(method, /billing_webhook_receipts/);
  assert.match(method, /existing\.digest !== digest/);
  assert.match(method, /exception_type, amount_minor, currency, subscription_paused/);
  assert.match(method, /\$\{verified\.type\}/);
  assert.match(method, /chargebackLost: verified\.chargebackLost === true/);
  assert.match(method, /UPDATE tenant_subscriptions SET status = 'paused'/);
  assert.doesNotMatch(method, /INSERT INTO billing_payments|SET status = 'active'/);
});
