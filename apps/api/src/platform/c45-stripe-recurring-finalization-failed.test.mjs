/** C45 synthetic Stripe TEST finalization failure reconciliation: no provider calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { verifyStripeSignature } from './stripe-policy.ts';
import { parseTerminalRecurringInvoice, assertTerminalRecurringProvider }
  from './stripe-recurring-terminal-invoice.ts';
import { requiresRecurringLifecycleReconciliation }
  from './stripe-recurring-unhandled-lifecycle.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const localId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const start = Date.parse('2026-11-01T00:00:00Z') / 1000;
const end = Date.parse('2026-12-01T00:00:00Z') / 1000;
const plan = { id: planId, code: 'pro', priceMinor: 2500, currency: 'USD',
  billingInterval: 'monthly', trialDays: 0, isActive: true };
const binding = { tenantId, subscriptionId: localId, planId,
  stripeSubscriptionId: 'sub_C45', stripeCustomerId: 'cus_C45',
  stripePriceId: 'price_C45', status: 'active',
  lastPeriodEndsAt: '2026-11-01T00:00:00.000Z', cancelAtPeriodEnd: false };
const local = { id: localId, planId, status: 'active',
  cancelAtPeriodEnd: false, periodStartsAt: '2026-10-01T00:00:00Z',
  periodEndsAt: '2026-11-01T00:00:00Z' };
const invoice = { object: 'invoice', id: 'in_C45', livemode: false,
  subscription: 'sub_C45', customer: 'cus_C45', status: 'draft', paid: false,
  last_finalization_error: { type: 'invalid_request_error', code: 'invalid_tax_location' },
  collection_method: 'charge_automatically', billing_reason: 'subscription_cycle',
  amount_due: 2500, total: 2500, amount_paid: 0, currency: 'usd',
  lines: { data: [{ price: 'price_C45', quantity: 1, amount: 2500,
    type: 'subscription', period: { start, end } }], has_more: false } };
const sub = { object: 'subscription', id: 'sub_C45', livemode: false,
  customer: 'cus_C45', status: 'active', cancel_at_period_end: false,
  latest_invoice: 'in_C45', metadata: { tenantId, planId },
  items: { data: [{ price: 'price_C45', quantity: 1 }], has_more: false } };
const event = (inv = invoice) => ({ id: 'evt_C45', type: 'invoice.finalization_failed',
  livemode: false, data: { object: inv } });
const raw = (inv = invoice) => Buffer.from(JSON.stringify(event(inv)));
const candidate = parseTerminalRecurringInvoice(raw(), false);
const verify = (i = invoice, s = sub, b = binding, l = local,
  now = Date.parse('2026-11-02T00:00:00Z')) =>
  assertTerminalRecurringProvider(candidate, i, s, null, b, plan, l, localId, false, now);

test('C45: signed TEST draft finalization failure is not a payment or grant', () => {
  const secret = 'whsec_12345678901234567890123456789012';
  const timestamp = 1793491200;
  const payload = raw();
  const sig = createHmac('sha256', secret).update(String(timestamp) + '.')
    .update(payload).digest('hex');
  const header = 't=' + timestamp + ',v1=' + sig;
  assert.equal(verifyStripeSignature(payload, header, secret, timestamp * 1000), true);
  assert.equal(verifyStripeSignature(Buffer.concat([payload, Buffer.from(' ')]),
    header, secret, timestamp * 1000), false);
  assert.equal(candidate.providerStatus, 'draft');
  assert.equal(candidate.eventType, 'invoice.finalization_failed');
  assert.equal(verify().shouldPause, true);
  assert.equal(verify(invoice, sub, binding, local,
    Date.parse('2026-10-31T00:00:00Z')).shouldPause, false);
  assert.equal(requiresRecurringLifecycleReconciliation(event()), true);
});

test('C45: signed event rejects LIVE, payment references and cross-tenant identity', () => {
  assert.throws(() => parseTerminalRecurringInvoice(raw(), true));
  for (const bad of [
    { ...invoice, livemode: true }, { ...invoice, status: 'open' },
    { ...invoice, amount_paid: 2500 }, { ...invoice, payment_intent: 'pi_FOREIGN' },
    { ...invoice, payments: { data: [{ payment: { payment_intent: 'pi_FOREIGN' } }] } },
    { ...invoice, parent: { subscription_details: { subscription: 'sub_FOREIGN' } } },
  ]) assert.throws(() => parseTerminalRecurringInvoice(raw(bad), false));
  for (const bad of [
    { ...invoice, last_finalization_error: null },
    { ...invoice, last_finalization_error: { type: '' } },
    { ...invoice, customer: 'cus_FOREIGN' },
    { ...invoice, lines: { ...invoice.lines, has_more: true } },
    { ...invoice, lines: { data: [{ ...invoice.lines.data[0], price: 'price_FOREIGN' }] } },
  ]) assert.throws(() => verify(bad));
  for (const bad of [
    { ...sub, metadata: { tenantId: planId, planId } },
    { ...sub, latest_invoice: 'in_OLD' }, { ...sub, status: 'canceled' },
  ]) assert.throws(() => verify(invoice, bad));
  for (const bad of [
    { ...binding, tenantId: planId }, { ...binding, stripePriceId: 'price_FOREIGN' },
    { ...binding, lastPeriodEndsAt: '2026-10-01T00:00:00Z' },
  ]) assert.throws(() => verify(invoice, sub, bad));
  assert.throws(() => verify(invoice, sub, binding, { ...local, status: 'canceled' }));
});

test('C45: webhook uses tenant lock, distinct replay ledger, and never settles funds', () => {
  const src = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const webhook = src.slice(src.indexOf('  async webhook('));
  assert.ok(webhook.indexOf('verifyStripeSignature(rawBody, header') <
    webhook.indexOf("signedEnvelope?.type === 'invoice.finalization_failed'"));
  assert.ok(webhook.indexOf("signedEnvelope?.type === 'invoice.finalization_failed'") <
    webhook.indexOf('requiresRecurringLifecycleReconciliation(signedEnvelope)'));
  assert.match(webhook, /return this\.recordRecurringTerminalInvoice\(candidate, sha256\(rawBody\), config\)/);
  const method = src.slice(src.indexOf('private async recordRecurringTerminalInvoice('),
    src.indexOf('private async recordRecurringResumption('));
  assert.match(method, /config\.liveMode \|\| process\.env\.DEPLOYMENT_ENV === 'production'/);
  assert.match(method, /withTenant\(tenantId, async tx =>/);
  assert.match(method, /pg_advisory_xact_lock/);
  assert.match(method, /FOR UPDATE OF b, s/);
  assert.match(method, /assertTerminalRecurringProvider/);
  assert.match(method, /billing\.stripe_recurring_invoice_finalization_failed/);
  assert.match(method, /payloadSha256/);
  assert.doesNotMatch(method, /INSERT INTO billing_payments|INSERT INTO billing_invoices|SET status = 'active'/);
});
