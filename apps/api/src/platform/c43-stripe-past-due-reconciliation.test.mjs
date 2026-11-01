/**
 * C43: synthetic Stripe TEST past_due status reconciliation.
 * No provider calls or live acceptance. A signed snapshot is not tenant
 * authority: the webhook must GET Stripe and lock the existing tenant ledger.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { verifyStripeSignature } from './stripe-policy.ts';
import { parseRecurringSuspension, assertRecurringSuspensionProvider,
  recurringSuspensionTransition } from './stripe-recurring-suspension.ts';
import { requiresRecurringLifecycleReconciliation } from './stripe-recurring-unhandled-lifecycle.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const planId = '33333333-3333-4333-8333-333333333333';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const ledger = { tenantId, subscriptionId, planId, stripeSubscriptionId: 'sub_C43',
  stripeCustomerId: 'cus_C43', stripePriceId: 'price_C43',
  bindingStatus: 'active', localStatus: 'active',
  localPeriodEndsAt: '2026-12-01T00:00:00Z' };
const provider = { object: 'subscription', id: 'sub_C43', livemode: false,
  status: 'past_due', customer: 'cus_C43', metadata: { tenantId, planId },
  items: { data: [{ price: { id: 'price_C43' }, quantity: 1 }],
    has_more: false, total_count: 1 } };
const envelope = (sub = provider) => ({
  id: 'evt_C43', type: 'customer.subscription.updated',
  livemode: false, data: { object: sub },
});
const signed = (sub = provider) => Buffer.from(JSON.stringify(envelope(sub)));

test('C43: signed TEST past_due is independently verified and never grants access', () => {
  const raw = signed();
  const secret = 'whsec_12345678901234567890123456789012';
  const timestamp = Math.floor(Date.now() / 1000);
  const mac = createHmac('sha256', secret)
    .update(String(timestamp)).update('.').update(raw).digest('hex');
  const header = `t=${timestamp},v1=${mac}`;
  assert.equal(verifyStripeSignature(raw, header, secret), true);
  assert.equal(verifyStripeSignature(Buffer.concat([raw, Buffer.from(' ')]),
    header, secret), false);
  const candidate = parseRecurringSuspension(raw, false);
  assert.equal(candidate.providerStatus, 'past_due');
  assert.doesNotThrow(() => assertRecurringSuspensionProvider(
    candidate, provider, ledger, subscriptionId, false));
  assert.equal(recurringSuspensionTransition(candidate, ledger,
    Date.parse('2026-11-30T00:00:00Z')), null);
  assert.equal(recurringSuspensionTransition(candidate, ledger,
    Date.parse('2026-12-01T00:00:00Z')), 'past_due');
  assert.equal(recurringSuspensionTransition(candidate,
    { ...ledger, localStatus: 'past_due' },
    Date.parse('2026-12-02T00:00:00Z')), null);
  assert.equal(recurringSuspensionTransition(candidate,
    { ...ledger, localStatus: 'paused' },
    Date.parse('2026-12-02T00:00:00Z')), null);
  assert.equal(requiresRecurringLifecycleReconciliation(envelope()), false);
});

test('C43: foreign tenant, mismatched provider identity, price, stale binding and LIVE fail closed', () => {
  const candidate = parseRecurringSuspension(signed(), false);
  assert.throws(() => parseRecurringSuspension(signed({ ...provider, livemode: true }), false));
  assert.throws(() => parseRecurringSuspension(signed(), true));
  assert.throws(() => parseRecurringSuspension(signed({
    ...provider, metadata: { tenantId: 'not-a-uuid', planId } }), false));
  assert.equal(parseRecurringSuspension(signed({
    ...provider, status: 'canceled' }), false), null);
  for (const bad of [
    { ...provider, metadata: { tenantId: planId, planId } },
    { ...provider, customer: 'cus_FOREIGN' },
    { ...provider, items: { data: [{ price: { id: 'price_FOREIGN' }, quantity: 1 }] } },
    { ...provider, livemode: true },
    { ...provider, status: 'active' },
  ]) assert.throws(() => assertRecurringSuspensionProvider(
    candidate, bad, ledger, subscriptionId, false));
  for (const bad of [
    { ...ledger, tenantId: planId },
    { ...ledger, planId: tenantId },
    { ...ledger, bindingStatus: 'canceled' },
    { ...ledger, localStatus: 'canceled' },
  ]) assert.throws(() => assertRecurringSuspensionProvider(
    candidate, provider, bad, subscriptionId, false));
  assert.throws(() => assertRecurringSuspensionProvider(
    candidate, provider, ledger, tenantId, false));
  assert.throws(() => assertRecurringSuspensionProvider(
    candidate, provider, ledger, subscriptionId, true));
});

test('C43: signed past_due is routed before fallback under tenant advisory/row locks', () => {
  const source = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const webhook = source.slice(source.indexOf('  async webhook('));
  const sig = webhook.indexOf('verifyStripeSignature(rawBody, header');
  const parse = webhook.indexOf('parseRecurringSuspension(rawBody, config.liveMode)');
  const fallback = webhook.indexOf('requiresRecurringLifecycleReconciliation(signedEnvelope)');
  assert.ok(sig >= 0 && parse > sig && fallback > parse);
  const start = source.indexOf('private async recordRecurringSuspension(');
  const end = source.indexOf('private async recordRecurringCancellation(');
  const handler = source.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.match(handler, /config\.liveMode \|\| process\.env\.DEPLOYMENT_ENV === 'production'/);
  assert.match(handler, /withTenant\(tenantId, async tx =>/);
  assert.match(handler, /pg_advisory_xact_lock/);
  assert.match(handler, /FOR UPDATE OF b, s/);
  assert.match(handler, /assertRecurringSuspensionProvider/);
  assert.match(handler, /payloadSha256/);
  assert.match(handler, /recurringSuspensionTransition/);
  assert.doesNotMatch(handler, /INSERT INTO billing_payments|INSERT INTO billing_invoices|SET status = 'active'/);
});
