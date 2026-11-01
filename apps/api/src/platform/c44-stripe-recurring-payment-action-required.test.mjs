/**
 * C44: signed Stripe TEST invoice.payment_action_required reconciliation.
 * Synthetic-only: no Stripe provider calls, real receipts or entitlement grants.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { verifyStripeSignature } from './stripe-policy.ts';
import { parseFailedRecurringInvoice, assertFailedRecurringProvider } from './stripe-recurring-failed-invoice.ts';
import { requiresRecurringLifecycleReconciliation } from './stripe-recurring-unhandled-lifecycle.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const localId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const start = 1793491200;
const end = 1796083200;
const plan = { id: planId, code: 'standard', priceMinor: 12000,
  currency: 'SAR', billingInterval: 'monthly', trialDays: 0, isActive: true };
const binding = { tenantId, subscriptionId: localId, planId,
  stripeSubscriptionId: 'sub_C44', stripeCustomerId: 'cus_C44',
  stripePriceId: 'price_C44', status: 'active',
  lastPeriodEndsAt: new Date(start * 1000).toISOString(), cancelAtPeriodEnd: false };
const local = { id: localId, planId, status: 'active', cancelAtPeriodEnd: false,
  periodStartsAt: '2026-10-01T00:00:00.000Z',
  periodEndsAt: new Date(start * 1000).toISOString() };
const invoice = { object: 'invoice', id: 'in_C44', livemode: false,
  status: 'open', paid: false, collection_method: 'charge_automatically',
  billing_reason: 'subscription_cycle', customer: 'cus_C44',
  subscription: 'sub_C44', currency: 'sar', amount_due: 12000,
  amount_paid: 0, amount_remaining: 12000, total: 12000, attempt_count: 1,
  payment_intent: 'pi_C44',
  lines: { data: [{ price: { id: 'price_C44' }, quantity: 1,
    amount: 12000, type: 'subscription', period: { start, end } }],
    has_more: false, total_count: 1 } };
const sub = { object: 'subscription', id: 'sub_C44', livemode: false,
  status: 'past_due', cancel_at_period_end: false,
  customer: 'cus_C44', latest_invoice: 'in_C44',
  metadata: { tenantId, planId },
  items: { data: [{ price: { id: 'price_C44' }, quantity: 1 }],
    has_more: false, total_count: 1 } };
const intent = { object: 'payment_intent', id: 'pi_C44', livemode: false,
  status: 'requires_action', amount: 12000, amount_received: 0,
  currency: 'sar', customer: 'cus_C44', invoice: 'in_C44' };
const event = (i = invoice, type = 'invoice.payment_action_required') =>
  ({ id: 'evt_C44', type, livemode: false, data: { object: i } });
const raw = (i = invoice, type) => Buffer.from(JSON.stringify(event(i, type)));
const candidate = parseFailedRecurringInvoice(raw(), false);
const verify = (c = candidate, i = invoice, s = sub, pi = intent,
  b = binding, l = local, latest = localId, now = Date.parse('2026-11-02T00:00:00Z')) =>
  assertFailedRecurringProvider(c, i, s, pi, b, plan, l, latest, false, now);

test('C44: HMAC verified action-required invoice is not a paid receipt', () => {
  const payload = raw(), secret = 'whsec_12345678901234567890123456789012';
  const timestamp = 1793491200;
  const digest = createHmac('sha256', secret).update(String(timestamp))
    .update('.').update(payload).digest('hex');
  const header = 't=' + timestamp + ',v1=' + digest;
  assert.equal(verifyStripeSignature(payload, header, secret, timestamp * 1000), true);
  assert.equal(verifyStripeSignature(Buffer.concat([payload, Buffer.from(' ')]),
    header, secret, timestamp * 1000), false);
  assert.equal(candidate.eventType, 'invoice.payment_action_required');
  assert.equal(candidate.invoiceId, invoice.id);
  assert.throws(() => parseFailedRecurringInvoice(raw({ ...invoice, payment_intent: null }), false));
  assert.throws(() => parseFailedRecurringInvoice(raw({ ...invoice,
    payments: { data: [{ payment: { payment_intent: 'pi_FOREIGN' } }] } }), false));
  assert.throws(() => parseFailedRecurringInvoice(raw({ ...invoice, paid: true }), false));
  assert.throws(() => parseFailedRecurringInvoice(raw({ ...invoice, attempt_count: 0 }), false));
  assert.throws(() => parseFailedRecurringInvoice(raw({ ...invoice, livemode: true }), false));
  assert.throws(() => parseFailedRecurringInvoice(raw(), true));
  assert.equal(requiresRecurringLifecycleReconciliation(event()), true,
    'fallback still rejects malformed/unhandled action-required invoices');
});

test('C44: provider GET must confirm requires_action and exact tenant binding', () => {
  assert.deepEqual(verify(), { shouldPause: true,
    periodEndsAt: new Date(end * 1000).toISOString() });
  assert.equal(verify(candidate, invoice, sub, intent, binding, local, localId,
    Date.parse('2026-10-31T00:00:00Z')).shouldPause, false);
  for (const bad of [
    { ...intent, status: 'succeeded', amount_received: 12000 },
    { ...intent, status: 'requires_payment_method' },
    { ...intent, customer: 'cus_OTHER' },
    { ...intent, invoice: 'in_OTHER' },
    { ...intent, livemode: true },
  ]) assert.throws(() => verify(candidate, invoice, sub, bad));
  for (const bad of [
    { ...binding, tenantId: planId },
    { ...binding, stripeCustomerId: 'cus_OTHER' },
    { ...binding, stripePriceId: 'price_OTHER' },
    { ...binding, cancelAtPeriodEnd: true },
  ]) assert.throws(() => verify(candidate, invoice, sub, intent, bad));
  for (const bad of [
    { ...invoice, status: 'paid', paid: true },
    { ...invoice, amount_remaining: 0 },
    { ...invoice, lines: { ...invoice.lines, has_more: true } },
    { ...invoice, lines: { data: [{ ...invoice.lines.data[0], price: 'price_OTHER' }] } },
  ]) assert.throws(() => verify(candidate, bad));
  assert.throws(() => verify(candidate, invoice, { ...sub, metadata: { tenantId: planId, planId } }));
  assert.throws(() => verify(candidate, invoice, sub, null));
  assert.throws(() => verify(candidate, invoice, sub, intent, binding, local, planId));
  assert.throws(() => verify(candidate, invoice, sub, intent, binding,
    { ...local, status: 'canceled' }));
  assert.throws(() => assertFailedRecurringProvider(candidate, invoice, sub,
    intent, binding, plan, local, localId, true));
});

test('C44: signed action-required route reuses tenant-locked replay ledger; no grants', () => {
  const src = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const webhook = src.slice(src.indexOf('async webhook('));
  const method = src.slice(src.indexOf('private async recordRecurringFailedInvoice('),
    src.indexOf('private async recordRecurringTerminalInvoice('));
  assert.ok(webhook.indexOf('verifyStripeSignature(rawBody, header') <
    webhook.indexOf("signedEnvelope?.type === 'invoice.payment_action_required'"));
  assert.match(webhook, /return this\.recordRecurringFailedInvoice\(failedCandidate, sha256\(rawBody\), config\)/);
  assert.match(method, /config\.liveMode \|\| process\.env\.DEPLOYMENT_ENV === 'production'/);
  assert.match(method, /withTenant\(tenantId, async tx =>/);
  assert.match(method, /pg_advisory_xact_lock/);
  assert.match(method, /FOR UPDATE OF b, s/);
  assert.match(method, /assertFailedRecurringProvider/);
  assert.match(method, /payloadSha256/);
  assert.match(method, /candidate\.eventType/);
  assert.match(method, /billing\.stripe_recurring_invoice_failed/);
  assert.match(method, /status = 'past_due'/);
  assert.doesNotMatch(method, /INSERT INTO billing_payments|INSERT INTO billing_invoices|status = 'active'/);
});
