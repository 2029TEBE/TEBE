import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertUnreversedRecurringCharge, recurringPaidChargeId } from './stripe-recurring-charge-guard.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const binding = { tenantId, subscriptionId, planId, status: 'active',
  stripeSubscriptionId: 'sub_C38', stripeCustomerId: 'cus_C38',
  stripePriceId: 'price_C38', cancelAtPeriodEnd: false, lastPeriodEndsAt: '2026-11-01T00:00:00Z' };
const paid = { tenantId, subscriptionId, planId,
  stripeSubscriptionId: 'sub_C38', stripeInvoiceId: 'in_C38',
  paymentIntentId: 'pi_C38', eventId: 'evt_C38', amountMinor: 12000,
  currency: 'SAR', periodStartsAt: '2026-11-01T00:00:00Z',
  periodEndsAt: '2026-12-01T00:00:00Z' };
const intent = { object: 'payment_intent', id: 'pi_C38', livemode: false,
  status: 'succeeded', latest_charge: 'ch_C38', customer: 'cus_C38',
  invoice: 'in_C38', amount_received: 12000, currency: 'sar' };
const charge = { object: 'charge', id: 'ch_C38', livemode: false,
  status: 'succeeded', payment_intent: 'pi_C38', customer: 'cus_C38',
  amount: 12000, amount_captured: 12000, amount_refunded: 0,
  currency: 'sar', paid: true, captured: true, refunded: false, disputed: false };
const check = (i = intent, c = charge, b = binding, p = paid, live = false) =>
  assertUnreversedRecurringCharge(i, c, b, p, live);

test('C38: verified, fully captured and unreversed TEST Charge may settle', () => {
  assert.equal(recurringPaidChargeId(intent), 'ch_C38');
  assert.doesNotThrow(() => check());
  assert.doesNotThrow(() => check({ ...intent, latest_charge: { id: 'ch_C38' } },
    { ...charge, payment_intent: { id: 'pi_C38' }, customer: { id: 'cus_C38' } }));
});

test('C38: paid Invoice and succeeded Intent do not override refund or dispute', () => {
  for (const c of [
    { ...charge, amount_refunded: 1 }, { ...charge, amount_refunded: 12000 },
    { ...charge, refunded: true }, { ...charge, disputed: true },
    { ...charge, captured: false }, { ...charge, paid: false },
    { ...charge, amount_captured: 11999 }, { ...charge, status: 'pending' },
  ]) assert.throws(() => check(intent, c));
});

test('C38: cross-tenant, changed funds and LIVE mode fail closed', () => {
  for (const b of [
    { ...binding, tenantId: planId }, { ...binding, subscriptionId: tenantId },
    { ...binding, planId: tenantId }, { ...binding, stripeCustomerId: 'cus_FOREIGN' },
  ]) assert.throws(() => check(intent, charge, b));
  for (const p of [
    { ...paid, tenantId: planId }, { ...paid, planId: tenantId },
    { ...paid, amountMinor: 11999 }, { ...paid, stripeSubscriptionId: 'sub_FOREIGN' },
    { ...paid, stripeInvoiceId: 'in_FOREIGN' },
  ]) assert.throws(() => check(intent, charge, binding, p));
  for (const i of [
    { ...intent, latest_charge: null }, { ...intent, latest_charge: 'ch_FOREIGN' },
    { ...intent, customer: 'cus_FOREIGN' }, { ...intent, invoice: 'in_FOREIGN' },
    { ...intent, amount_received: 11999 }, { ...intent, livemode: true },
  ]) assert.throws(() => check(i));
  for (const c of [
    { ...charge, id: 'ch_FOREIGN' }, { ...charge, payment_intent: 'pi_FOREIGN' },
    { ...charge, customer: 'cus_FOREIGN' }, { ...charge, livemode: true },
    { ...charge, amount: 11999 }, { ...charge, currency: 'usd' },
  ]) assert.throws(() => check(intent, c));
  assert.throws(() => check(intent, charge, binding, paid, true));
});

test('C38: new settlement checks independent Charge before inserting entitlement', () => {
  const src = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const method = src.slice(src.indexOf('private async settleRecurringInvoice('),
    src.indexOf('/** Stripe signs the raw request.'));
  const verified = method.indexOf('assertUnreversedRecurringCharge(');
  const grant = method.indexOf('INSERT INTO billing_invoices');
  assert.ok(method.indexOf('getStripe(`charges/${chargeId}`)') >= 0);
  assert.ok(method.indexOf('recurringPaidChargeId(intent)') >= 0);
  assert.ok(verified > 0 && grant > verified);
  assert.ok(method.indexOf('if (prior)') < verified);
  assert.match(method, /config\.liveMode \|\| process\.env\.DEPLOYMENT_ENV === 'production'/);
  assert.match(method, /pg_advisory_xact_lock/);
  assert.match(method, /FOR UPDATE OF b, s/);
});
