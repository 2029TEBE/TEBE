import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { verifyStripeSignature } from './stripe-policy.ts';
import { parseTerminalRecurringInvoice, assertTerminalRecurringProvider }
  from './stripe-recurring-terminal-invoice.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const start = Date.parse('2026-11-01T00:00:00Z') / 1000;
const end = Date.parse('2026-12-01T00:00:00Z') / 1000;
const plan = { id: planId, code: 'pro', priceMinor: 2500,
  currency: 'USD', billingInterval: 'monthly', trialDays: 0, isActive: true };
const binding = { tenantId, subscriptionId, planId,
  stripeSubscriptionId: 'sub_C42', stripeCustomerId: 'cus_C42',
  stripePriceId: 'price_C42', status: 'active',
  lastPeriodEndsAt: '2026-11-01T00:00:00.000Z', cancelAtPeriodEnd: false };
const local = { id: subscriptionId, planId, status: 'active',
  cancelAtPeriodEnd: false, periodStartsAt: '2026-10-01T00:00:00Z',
  periodEndsAt: '2026-11-01T00:00:00Z' };
const invoice = { object: 'invoice', id: 'in_C42', livemode: false,
  subscription: 'sub_C42', customer: 'cus_C42', status: 'void', paid: false,
  collection_method: 'charge_automatically', billing_reason: 'subscription_cycle',
  amount_due: 2500, total: 2500, amount_paid: 0, currency: 'usd',
  lines: { data: [{ price: 'price_C42', quantity: 1, amount: 2500,
    type: 'subscription', period: { start, end } }], has_more: false },
};
const subscription = { object: 'subscription', id: 'sub_C42', livemode: false,
  customer: 'cus_C42', status: 'past_due', cancel_at_period_end: false,
  latest_invoice: 'in_C42', metadata: { tenantId, planId },
  items: { data: [{ price: 'price_C42', quantity: 1 }], has_more: false } };
const envelope = (type, inv, eventId = 'evt_C42') =>
  Buffer.from(JSON.stringify({ id: eventId, type, livemode: false,
    data: { object: inv } }));
const raw = envelope('invoice.voided', invoice);
const candidate = parseTerminalRecurringInvoice(raw, false);
const verify = (c = candidate, i = invoice, s = subscription,
  b = binding, l = local, intent = null, now = Date.parse('2026-11-02T00:00:00Z')) =>
  assertTerminalRecurringProvider(c, i, s, intent, b, plan, l, subscriptionId, false, now);

test('C42: signature-first TEST voided invoice is bound to provider and expired period', () => {
  const secret = 'whsec_12345678901234567890123456789012';
  const timestamp = 1793491200;
  const sig = createHmac('sha256', secret).update(String(timestamp) + '.')
    .update(raw).digest('hex');
  const header = 't=' + timestamp + ',v1=' + sig;
  assert.equal(verifyStripeSignature(raw, header, secret, timestamp * 1000), true);
  assert.equal(verifyStripeSignature(Buffer.concat([raw, Buffer.from(' ')]),
    header, secret, timestamp * 1000), false);
  assert.equal(candidate.providerStatus, 'void');
  assert.equal(verify().shouldPause, true);
  assert.equal(verify(candidate, invoice, subscription, binding, local, null,
    Date.parse('2026-10-30T00:00:00Z')).shouldPause, false);
});

test('C42: marked uncollectible is terminal; one-time and unrelated events bypass', () => {
  const uncollectible = { ...invoice, status: 'uncollectible' };
  const c = parseTerminalRecurringInvoice(
    envelope('invoice.marked_uncollectible', uncollectible), false);
  assert.equal(c.providerStatus, 'uncollectible');
  assert.equal(verify(c, uncollectible).shouldPause, true);
  assert.equal(parseTerminalRecurringInvoice(
    envelope('invoice.voided', { ...invoice, subscription: null,
      billing_reason: 'manual' }), false), null);
  assert.equal(parseTerminalRecurringInvoice(envelope('invoice.paid', invoice), false), null);
});

test('C42: LIVE, cross-tenant, changed plan, collected funds and stale invoices fail closed', () => {
  assert.throws(() => parseTerminalRecurringInvoice(raw, true));
  assert.throws(() => parseTerminalRecurringInvoice(
    envelope('invoice.voided', { ...invoice, livemode: true }), false));
  assert.throws(() => parseTerminalRecurringInvoice(
    envelope('invoice.voided', { ...invoice, parent: {
      subscription_details: { subscription: 'sub_FOREIGN' } } }), false));
  for (const bad of [
    { ...invoice, paid: true }, { ...invoice, amount_paid: 2500 },
    { ...invoice, status: 'paid' }, { ...invoice, total: 2600 },
    { ...invoice, customer: 'cus_FOREIGN' },
    { ...invoice, lines: { ...invoice.lines, has_more: true } },
    { ...invoice, lines: { data: [{ ...invoice.lines.data[0], price: 'price_FOREIGN' }] } },
    { ...invoice, lines: { data: [{ ...invoice.lines.data[0], period: { start: start - 86400, end } }] } },
    { ...invoice, payments: { data: [{ payment: { charge: 'ch_C42' } }] } },
  ]) assert.throws(() => verify(candidate, bad));
  for (const bad of [
    { ...subscription, metadata: { tenantId: planId, planId } },
    { ...subscription, customer: 'cus_FOREIGN' },
    { ...subscription, latest_invoice: 'in_STALE' },
    { ...subscription, items: { ...subscription.items, has_more: true } },
    { ...subscription, status: 'canceled' },
  ]) assert.throws(() => verify(candidate, invoice, bad));
  for (const bad of [
    { ...binding, tenantId: planId }, { ...binding, planId: tenantId },
    { ...binding, stripePriceId: 'price_FOREIGN' },
    { ...binding, status: 'canceled' },
    { ...binding, lastPeriodEndsAt: '2026-10-01T00:00:00Z' },
  ]) assert.throws(() => verify(candidate, invoice, subscription, bad));
  assert.throws(() => verify(candidate, invoice, subscription, binding,
    { ...local, cancelAtPeriodEnd: true }));
  assert.throws(() => verify(candidate, invoice, subscription, binding,
    { ...local, status: 'canceled' }));
});

test('C42: unpaid PaymentIntent is checked; succeeded or foreign funds fail closed', () => {
  const i = { ...invoice, payment_intent: 'pi_C42' };
  const intent = { object: 'payment_intent', id: 'pi_C42', livemode: false,
    status: 'canceled', amount: 2500, amount_received: 0, currency: 'usd',
    customer: 'cus_C42', invoice: 'in_C42' };
  assert.equal(verify(candidate, i, subscription, binding, local, intent).shouldPause, true);
  for (const bad of [
    { ...intent, status: 'succeeded' }, { ...intent, amount_received: 2500 },
    { ...intent, customer: 'cus_FOREIGN' }, { ...intent, invoice: 'in_FOREIGN' },
  ]) assert.throws(() => verify(candidate, i, subscription, binding, local, bad));
  assert.throws(() => verify(candidate, i));
});

test('C42: webhook is signed, TEST-only, locked, replay-safe, never grants access', () => {
  const src = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const webhook = src.slice(src.indexOf('  async webhook('));
  assert.ok(webhook.indexOf('verifyStripeSignature(rawBody, header') <
    webhook.indexOf('parseTerminalRecurringInvoice(rawBody, config.liveMode)'));
  assert.ok(webhook.indexOf('parseTerminalRecurringInvoice(rawBody, config.liveMode)') <
    webhook.indexOf('requiresRecurringLifecycleReconciliation(signedEnvelope)'));
  const method = src.slice(src.indexOf('private async recordRecurringTerminalInvoice('),
    src.indexOf('private async recordRecurringResumption('));
  assert.match(method, /config\.liveMode \|\| process\.env\.DEPLOYMENT_ENV === 'production'/);
  assert.match(method, /withTenant\(tenantId, async tx =>/);
  assert.match(method, /pg_advisory_xact_lock/);
  assert.match(method, /FOR UPDATE OF b, s/);
  assert.match(method, /assertTerminalRecurringProvider/);
  assert.match(method, /billing\.stripe_recurring_invoice_settled/);
  assert.match(method, /payloadSha256/);
  assert.doesNotMatch(method, /INSERT INTO billing_payments|INSERT INTO billing_invoices|SET status = 'active'/);
});
