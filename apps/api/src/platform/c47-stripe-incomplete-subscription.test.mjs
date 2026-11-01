/** C47: synthetic signed TEST-only incomplete subscription reconciliation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { verifyStripeSignature } from './stripe-policy.ts';
import { parseRecurringSuspension, assertRecurringSuspensionProvider,
  recurringSuspensionTransition } from './stripe-recurring-suspension.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const localId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const provider = {
  object: 'subscription', id: 'sub_C47', livemode: false,
  customer: 'cus_C47', status: 'incomplete',
  metadata: { tenantId, planId },
  items: { data: [{ price: 'price_C47', quantity: 1 }],
    has_more: false, total_count: 1 },
};
const ledger = {
  tenantId, subscriptionId: localId, planId,
  stripeSubscriptionId: provider.id, stripeCustomerId: provider.customer,
  stripePriceId: 'price_C47', bindingStatus: 'pending',
  localStatus: 'active', localPeriodEndsAt: '2026-12-01T00:00:00Z',
};
const raw = (sub = provider, type = 'customer.subscription.updated') =>
  Buffer.from(JSON.stringify({
    id: 'evt_C47', type, livemode: false, data: { object: sub },
  }));
const parse = (sub = provider) => parseRecurringSuspension(raw(sub), false);

test('C47: verified signed TEST incomplete never grants or extends access', () => {
  const payload = raw();
  const secret = 'whsec_12345678901234567890123456789012';
  const timestamp = 1793491200;
  const sig = createHmac('sha256', secret)
    .update(String(timestamp) + '.').update(payload).digest('hex');
  const header = 't=' + timestamp + ',v1=' + sig;
  assert.equal(verifyStripeSignature(payload, header, secret, timestamp * 1000), true);
  assert.equal(verifyStripeSignature(Buffer.concat([payload, Buffer.from(' ')]),
    header, secret, timestamp * 1000), false);
  const candidate = parse();
  assert.equal(candidate.providerStatus, 'incomplete');
  assert.doesNotThrow(() =>
    assertRecurringSuspensionProvider(candidate, provider, ledger, localId, false));
  assert.equal(recurringSuspensionTransition(candidate, ledger,
    Date.parse('2026-11-15T00:00:00Z')), null);
  assert.equal(recurringSuspensionTransition(candidate, ledger,
    Date.parse('2026-12-02T00:00:00Z')), 'past_due');
  assert.equal(recurringSuspensionTransition(candidate,
    { ...ledger, localStatus: 'past_due' },
    Date.parse('2026-12-02T00:00:00Z')), null);
});

test('C47: independently verified incomplete_expired terminates immediately and is idempotent', () => {
  const remote = { ...provider, status: 'incomplete_expired' };
  const candidate = parse(remote);
  assert.equal(candidate.providerStatus, 'incomplete_expired');
  assert.doesNotThrow(() =>
    assertRecurringSuspensionProvider(candidate, remote, ledger, localId, false));
  assert.equal(recurringSuspensionTransition(candidate, ledger,
    Date.parse('2026-11-01T00:00:00Z')), 'canceled');
  assert.equal(recurringSuspensionTransition(candidate,
    { ...ledger, localStatus: 'canceled' }), null);
  assert.throws(() => recurringSuspensionTransition(parse(),
    { ...ledger, localStatus: 'canceled' }));
  assert.throws(() => assertRecurringSuspensionProvider(parse(), provider,
    { ...ledger, localStatus: 'canceled' }, localId, false));
});

test('C47: LIVE, cross-tenant, stale, wrong price and malformed identities fail closed', () => {
  assert.throws(() => parseRecurringSuspension(raw(), true));
  assert.throws(() => parseRecurringSuspension(raw({ ...provider, livemode: true }), false));
  assert.throws(() => parseRecurringSuspension(raw({ ...provider, metadata: {
    tenantId: 'bad', planId } }), false));
  assert.throws(() => parseRecurringSuspension(Buffer.from('{'), false));
  assert.throws(() => parseRecurringSuspension(raw(provider,
    'customer.subscription.paused'), false));
  for (const bad of [
    { ...provider, status: 'active' },
    { ...provider, customer: 'cus_FOREIGN' },
    { ...provider, metadata: { tenantId: planId, planId } },
    { ...provider, items: { data: [{ price: 'price_FOREIGN', quantity: 1 }] } },
    { ...provider, items: { ...provider.items, has_more: true } },
    { ...provider, livemode: true },
  ]) assert.throws(() =>
    assertRecurringSuspensionProvider(parse(), bad, ledger, localId, false));
  for (const bad of [
    { ...ledger, tenantId: planId },
    { ...ledger, planId: tenantId },
    { ...ledger, stripeCustomerId: 'cus_FOREIGN' },
    { ...ledger, bindingStatus: 'canceled' },
  ]) assert.throws(() =>
    assertRecurringSuspensionProvider(parse(), provider, bad, localId, false));
  assert.throws(() =>
    assertRecurringSuspensionProvider(parse(), provider, ledger, planId, false));
});

test('C47: webhook verifies HMAC first; tenant locks, terminal flags and replay ledger are preserved', () => {
  const src = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const webhook = src.slice(src.indexOf('  async webhook('));
  assert.ok(webhook.indexOf('verifyStripeSignature(rawBody, header') <
    webhook.indexOf('parseRecurringSuspension(rawBody, config.liveMode)'));
  const method = src.slice(src.indexOf('private async recordRecurringSuspension('),
    src.indexOf('private async recordRecurringCancellation('));
  assert.match(method, /config\.liveMode \|\| process\.env\.DEPLOYMENT_ENV === 'production'/);
  assert.match(method, /withTenant\(tenantId, async tx =>/);
  assert.match(method, /pg_advisory_xact_lock/);
  assert.match(method, /FOR UPDATE OF b, s/);
  assert.match(method, /assertRecurringSuspensionProvider/);
  assert.match(method, /payloadSha256/);
  assert.match(method, /if \(candidate\.providerStatus === 'incomplete_expired'\)/);
  assert.match(method, /UPDATE billing_stripe_recurring_bindings/);
  assert.match(method, /SET cancel_at_period_end = true/);
  assert.match(method, /cancel_at_period_end = CASE WHEN/);
  assert.doesNotMatch(method, /INSERT INTO billing_payments|INSERT INTO billing_invoices|SET status = 'active'/);
});
