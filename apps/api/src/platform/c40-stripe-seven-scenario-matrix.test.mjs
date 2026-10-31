/**
 * C40: seven deterministic, synthetic Stripe TEST lifecycle scenarios.
 * These exercise the same pure provider/tenant guards wired into the webhook.
 * They are NOT Stripe-provider receipts, HTTP staging acceptance, or DB/RLS proof.
 * Keep all fixtures fake and every test non-networking.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { verifyStripeSignature, parseStripePaymentException } from './stripe-policy.ts';
import { assertRecurringStripePrice, stripeRecurringCheckoutParams,
  assertCreatedRecurringCheckout } from './stripe-recurring-policy.ts';
import { parsePaidRecurringInvoice } from './stripe-recurring-invoice.ts';
import { assertRecurringProviderSettlement } from './stripe-recurring-reconciliation.ts';
import { assertRecurringLocalSettlement } from './stripe-recurring-local-settlement.ts';
import { assertUnreversedRecurringCharge } from './stripe-recurring-charge-guard.ts';
import { parseFailedRecurringInvoice, assertFailedRecurringProvider } from './stripe-recurring-failed-invoice.ts';
import { parseRecurringCancellation, assertRecurringCancellationProvider } from './stripe-recurring-cancellation.ts';
import { parseRecurringSuspension, assertRecurringSuspensionProvider,
  recurringSuspensionTransition } from './stripe-recurring-suspension.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenant = '99999999-9999-4999-8999-999999999999';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const start = 1793491200; // 2026-11-01
const end = 1796083200; // 2026-12-01
const now = Date.parse('2026-11-02T00:00:00Z');
const periodStart = new Date(start * 1000).toISOString();
const periodEnd = new Date(end * 1000).toISOString();
const plan = { id: planId, code: 'standard', priceMinor: 12000,
  currency: 'SAR', billingInterval: 'monthly', trialDays: 0, isActive: true };
const binding = { tenantId, subscriptionId, planId,
  stripeSubscriptionId: 'sub_C40', stripeCustomerId: 'cus_C40',
  stripePriceId: 'price_C40', status: 'pending',
  lastPeriodEndsAt: null, cancelAtPeriodEnd: false };
const activeBinding = { ...binding, status: 'active',
  lastPeriodEndsAt: periodStart };
const local = { id: subscriptionId, planId, status: 'trialing',
  cancelAtPeriodEnd: false, periodStartsAt: '2026-10-01T00:00:00Z',
  periodEndsAt: periodStart };
const activeLocal = { ...local, status: 'active' };
const provider = { object: 'subscription', id: 'sub_C40',
  livemode: false, status: 'active', cancel_at_period_end: false,
  customer: 'cus_C40', latest_invoice: 'in_C40',
  metadata: { tenantId, planId },
  items: { data: [{ price: { id: 'price_C40' }, quantity: 1 }],
    has_more: false, total_count: 1 } };
const invoice = { object: 'invoice', id: 'in_C40', livemode: false,
  status: 'paid', paid: true, collection_method: 'charge_automatically',
  billing_reason: 'subscription_create', customer: 'cus_C40',
  subscription: 'sub_C40', currency: 'sar', amount_due: 12000,
  amount_paid: 12000, amount_remaining: 0, total: 12000,
  payment_intent: 'pi_C40',
  lines: { data: [{ price: { id: 'price_C40' }, quantity: 1,
    amount: 12000, type: 'subscription', period: { start, end } }],
    has_more: false, total_count: 1 } };
const intent = { object: 'payment_intent', id: 'pi_C40',
  livemode: false, status: 'succeeded', amount: 12000,
  amount_received: 12000, currency: 'sar', customer: 'cus_C40',
  invoice: 'in_C40', latest_charge: 'ch_C40' };
const charge = { object: 'charge', id: 'ch_C40', livemode: false,
  payment_intent: 'pi_C40', customer: 'cus_C40', status: 'succeeded',
  currency: 'sar', paid: true, captured: true, amount: 12000,
  amount_captured: 12000, amount_refunded: 0,
  refunded: false, disputed: false };
const rawEvent = (type, object, id = 'evt_C40') => Buffer.from(JSON.stringify({
  id, type, livemode: false, data: { object },
}));
const signedHeader = raw => {
  const timestamp = start;
  const secret = 'whsec_12345678901234567890123456789012';
  const digest = createHmac('sha256', secret)
    .update(String(timestamp)).update('.').update(raw).digest('hex');
  return { header: 't=' + timestamp + ',v1=' + digest, secret };
};
const paid = (inv = invoice, b = binding, p = provider, pi = intent) => {
  const candidate = parsePaidRecurringInvoice(rawEvent('invoice.paid', inv), false);
  return assertRecurringProviderSettlement(candidate, inv, p, pi, b, plan, false);
};

test('C40 scenario 1/7: TEST subscription Checkout is pending, not an entitlement', () => {
  const price = { object: 'price', id: 'price_C40', active: true,
    livemode: false, type: 'recurring', billing_scheme: 'per_unit',
    currency: 'sar', unit_amount: 12000,
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } };
  const verifiedPrice = assertRecurringStripePrice(price, plan, 'price_C40', false);
  const params = stripeRecurringCheckoutParams(plan, tenantId, verifiedPrice, false,
    'https://staging.theepmo.com/billing/success',
    'https://staging.theepmo.com/billing/cancel');
  assert.equal(params.get('mode'), 'subscription');
  assert.equal(params.get('line_items[0][quantity]'), '1');
  const session = { object: 'checkout.session', id: 'cs_test_C40',
    livemode: false, mode: 'subscription', status: 'open',
    payment_status: 'unpaid', subscription: null,
    client_reference_id: tenantId, metadata: { tenantId, planId },
    currency: 'sar', amount_total: 12000, expires_at: start + 3600,
    url: 'https://checkout.stripe.com/c/pay/cs_test_C40' };
  assert.equal(assertCreatedRecurringCheckout(session, plan, tenantId, false,
    start * 1000).sessionId, session.id);
  assert.throws(() => assertCreatedRecurringCheckout(
    { ...session, livemode: true }, plan, tenantId, false, start * 1000));
});

test('C40 scenario 2/7: signed paid invoice + independent provider + charge allow initial settlement', () => {
  const raw = rawEvent('invoice.paid', invoice);
  const { header, secret } = signedHeader(raw);
  assert.equal(verifyStripeSignature(raw, header, secret, start * 1000), true);
  assert.equal(verifyStripeSignature(Buffer.concat([raw, Buffer.from(' ')]),
    header, secret, start * 1000), false);
  const verified = paid();
  assert.doesNotThrow(() => assertRecurringLocalSettlement(
    binding, local, verified, subscriptionId, now));
  assert.doesNotThrow(() => assertUnreversedRecurringCharge(
    intent, charge, binding, verified, false));
  assert.throws(() => paid(invoice, { ...binding, tenantId: otherTenant }));
  assert.throws(() => paid(invoice, binding, { ...provider, livemode: true }));
});

test('C40 scenario 3/7: contiguous renewal only; replay cannot extend a period', () => {
  const cycle = { ...invoice, billing_reason: 'subscription_cycle' };
  const verified = paid(cycle, activeBinding);
  assert.doesNotThrow(() => assertRecurringLocalSettlement(
    activeBinding, activeLocal, verified, subscriptionId, now));
  assert.throws(() => assertRecurringLocalSettlement(
    { ...activeBinding, lastPeriodEndsAt: periodEnd },
    activeLocal, verified, subscriptionId, now));
  assert.throws(() => assertRecurringLocalSettlement(
    activeBinding, { ...activeLocal, periodEndsAt: periodEnd },
    verified, subscriptionId, now));
  const source = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const method = source.slice(source.indexOf('private async settleRecurringInvoice('),
    source.indexOf('/** Stripe signs the raw request.'));
  assert.match(method, /billing_webhook_receipts/);
  assert.match(method, /Recurring invoice period is already recorded/);
  assert.match(method, /pg_advisory_xact_lock/);
});

test('C40 scenario 4/7: failed renewal never creates a paid entitlement', () => {
  const failed = { ...invoice, status: 'open', paid: false,
    billing_reason: 'subscription_cycle', amount_paid: 0,
    amount_remaining: 12000, attempt_count: 1 };
  const candidate = parseFailedRecurringInvoice(
    rawEvent('invoice.payment_failed', failed), false);
  const failedProvider = { ...provider, status: 'past_due' };
  const failedIntent = { ...intent, status: 'requires_payment_method',
    amount_received: 0 };
  const result = assertFailedRecurringProvider(candidate, failed,
    failedProvider, failedIntent, activeBinding, plan, activeLocal,
    subscriptionId, false, now);
  assert.equal(result.shouldPause, true);
  assert.throws(() => paid(failed, activeBinding, failedProvider, failedIntent));
  assert.throws(() => assertFailedRecurringProvider(candidate, failed,
    failedProvider, failedIntent, { ...activeBinding, tenantId: otherTenant },
    plan, activeLocal, subscriptionId, false, now));
});

test('C40 scenario 5/7: late paid renewal restores past_due only with exact failure proof', () => {
  const cycle = { ...invoice, billing_reason: 'subscription_cycle' };
  const verified = paid(cycle, activeBinding);
  const expired = { ...activeLocal, status: 'past_due' };
  assert.throws(() => assertRecurringLocalSettlement(
    activeBinding, expired, verified, subscriptionId, now, false));
  assert.doesNotThrow(() => assertRecurringLocalSettlement(
    activeBinding, expired, verified, subscriptionId, now, true));
  assert.throws(() => assertRecurringLocalSettlement(
    activeBinding, { ...expired, status: 'paused' },
    verified, subscriptionId, now, true));
  assert.throws(() => assertRecurringLocalSettlement(
    activeBinding, expired, verified, otherTenant, now, true));
});

test('C40 scenario 6/7: refunds and disputes block new entitlement grants', () => {
  const verified = paid();
  assert.throws(() => assertUnreversedRecurringCharge(intent,
    { ...charge, amount_refunded: 1000, refunded: true },
    binding, verified, false));
  assert.throws(() => assertUnreversedRecurringCharge(intent,
    { ...charge, disputed: true }, binding, verified, false));
  assert.throws(() => assertUnreversedRecurringCharge(intent,
    charge, { ...binding, tenantId: otherTenant }, verified, false));
  const refund = parseStripePaymentException(rawEvent('charge.refunded',
    { ...charge, amount_refunded: 12000, refunded: true }), false);
  const dispute = parseStripePaymentException(rawEvent('charge.dispute.created',
    { object: 'dispute', id: 'dp_C40', livemode: false,
      charge: 'ch_C40', payment_intent: 'pi_C40', amount: 12000,
      currency: 'sar', status: 'needs_response' }), false);
  assert.equal(refund.type, 'charge.refunded');
  assert.equal(dispute.type, 'charge.dispute.created');
});

test('C40 scenario 7/7: cancellation and pause/unpaid are non-granting and tenant-bound', () => {
  const canceled = { ...provider, status: 'canceled' };
  const candidate = parseRecurringCancellation(
    rawEvent('customer.subscription.deleted', canceled), false);
  const ledger = { tenantId, subscriptionId, planId,
    stripeSubscriptionId: provider.id, stripeCustomerId: provider.customer,
    stripePriceId: binding.stripePriceId, bindingStatus: 'active',
    localStatus: 'active' };
  assert.doesNotThrow(() => assertRecurringCancellationProvider(
    candidate, canceled, ledger, subscriptionId, false));
  assert.throws(() => assertRecurringCancellationProvider(
    candidate, canceled, { ...ledger, tenantId: otherTenant }, subscriptionId, false));
  const paused = { ...provider, status: 'paused' };
  const suspension = parseRecurringSuspension(
    rawEvent('customer.subscription.paused', paused), false);
  const state = { ...ledger, localPeriodEndsAt: periodEnd };
  assert.doesNotThrow(() => assertRecurringSuspensionProvider(
    suspension, paused, state, subscriptionId, false));
  assert.equal(recurringSuspensionTransition(suspension, state, now), 'paused');
  const unpaid = { ...provider, status: 'unpaid' };
  const unpaidCandidate = parseRecurringSuspension(
    rawEvent('customer.subscription.updated', unpaid), false);
  assert.equal(recurringSuspensionTransition(unpaidCandidate, state, now), null);
  assert.equal(recurringSuspensionTransition(unpaidCandidate, state,
    Date.parse('2026-12-02T00:00:00Z')), 'past_due');
  assert.throws(() => assertRecurringSuspensionProvider(
    suspension, paused, { ...state, tenantId: otherTenant }, subscriptionId, false));
});
