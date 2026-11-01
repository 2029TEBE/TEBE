/** C46: synthetic TEST-only canceled subscription.updated revocation regression.
 * No provider requests, payment execution, or staging acceptance.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { verifyStripeSignature } from './stripe-policy.ts';
import { parseRecurringCancellation, assertRecurringCancellationProvider }
  from './stripe-recurring-cancellation.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const localId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const subscription = {
  object: 'subscription', id: 'sub_C46', livemode: false,
  customer: 'cus_C46', status: 'canceled', cancel_at_period_end: false,
  metadata: { tenantId, planId },
  items: { data: [{ price: 'price_C46', quantity: 1 }],
    has_more: false, total_count: 1 },
};
const ledger = {
  tenantId, subscriptionId: localId, planId,
  stripeSubscriptionId: subscription.id,
  stripeCustomerId: subscription.customer, stripePriceId: 'price_C46',
  bindingStatus: 'active', localStatus: 'active',
};
const envelope = (sub = subscription, type = 'customer.subscription.updated') =>
  ({ id: 'evt_C46', type, livemode: false, data: { object: sub } });
const raw = (sub = subscription, type) => Buffer.from(JSON.stringify(envelope(sub, type)));
const parse = (sub = subscription, type) =>
  parseRecurringCancellation(raw(sub, type), false);

test('C46: HMAC-verified TEST canceled updated revokes immediately, not ignored', () => {
  const payload = raw();
  const secret = 'whsec_12345678901234567890123456789012';
  const timestamp = 1793491200;
  const signature = createHmac('sha256', secret)
    .update(String(timestamp) + '.').update(payload).digest('hex');
  const header = 't=' + timestamp + ',v1=' + signature;
  assert.equal(verifyStripeSignature(payload, header, secret, timestamp * 1000), true);
  assert.equal(verifyStripeSignature(Buffer.concat([payload, Buffer.from(' ')]),
    header, secret, timestamp * 1000), false);
  const candidate = parse();
  assert.equal(candidate.terminal, true);
  assert.equal(candidate.tenantId, tenantId);
  assert.doesNotThrow(() =>
    assertRecurringCancellationProvider(candidate, subscription, ledger, localId, false));
  assert.equal(parse({ ...subscription, cancel_at_period_end: true }).terminal, true);
  assert.equal(parse(subscription, 'customer.subscription.deleted').terminal, true);
});

test('C46: ordinary updates retain scheduled/no-op behavior; invalid modes fail', () => {
  assert.equal(parse({ ...subscription, status: 'active',
    cancel_at_period_end: false }), null);
  const scheduled = parse({ ...subscription, status: 'active',
    cancel_at_period_end: true });
  assert.equal(scheduled.terminal, false);
  for (const bad of [
    { ...subscription, livemode: true },
    { ...subscription, customer: 'cus_FOREIGN', metadata: { tenantId: 'bad', planId } },
    { ...subscription, id: 'bad' },
  ]) assert.throws(() => parse(bad));
  assert.equal(parse({ ...subscription, status: 'incomplete_expired' }), null);
  assert.throws(() => parseRecurringCancellation(raw(), true));
  assert.throws(() => parseRecurringCancellation(Buffer.from('{'), false));
});

test('C46: independent provider and tenant ledger cannot revoke a foreign tenant', () => {
  const candidate = parse();
  for (const remote of [
    { ...subscription, status: 'active' },
    { ...subscription, livemode: true },
    { ...subscription, customer: 'cus_FOREIGN' },
    { ...subscription, metadata: { tenantId: planId, planId } },
    { ...subscription, items: { ...subscription.items, has_more: true } },
    { ...subscription, items: { data: [{ price: 'price_FOREIGN', quantity: 1 }] } },
  ]) assert.throws(() =>
    assertRecurringCancellationProvider(candidate, remote, ledger, localId, false));
  for (const local of [
    { ...ledger, tenantId: planId },
    { ...ledger, planId: tenantId },
    { ...ledger, stripeSubscriptionId: 'sub_FOREIGN' },
    { ...ledger, stripeCustomerId: 'cus_FOREIGN' },
    { ...ledger, bindingStatus: 'unknown' },
  ]) assert.throws(() =>
    assertRecurringCancellationProvider(candidate, subscription, local, localId, false));
  assert.throws(() =>
    assertRecurringCancellationProvider(candidate, subscription, ledger, planId, false));
  assert.throws(() =>
    assertRecurringCancellationProvider(candidate, subscription, ledger, localId, true));
});

test('C46: signed terminal update flows through tenant lock and digest replay; no grant', () => {
  const src = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const webhook = src.slice(src.indexOf('  async webhook('));
  const method = src.slice(src.indexOf('private async recordRecurringCancellation('),
    src.indexOf('private async recordRecurringFailedInvoice('));
  assert.ok(webhook.indexOf('verifyStripeSignature(rawBody, header') <
    webhook.indexOf('parseRecurringCancellation(rawBody, config.liveMode)'));
  assert.match(webhook, /return this\.recordRecurringCancellation\(cancellation, sha256\(rawBody\), config\)/);
  assert.match(method, /config\.liveMode \|\| process\.env\.DEPLOYMENT_ENV === 'production'/);
  assert.match(method, /withTenant\(tenantId, async tx =>/);
  assert.match(method, /pg_advisory_xact_lock/);
  assert.match(method, /FOR UPDATE OF b, s/);
  assert.match(method, /assertRecurringCancellationProvider/);
  assert.match(method, /payloadSha256/);
  assert.match(method, /CASE WHEN \$\{candidate\.terminal\} THEN 'canceled'/);
  assert.doesNotMatch(method, /INSERT INTO billing_payments|SET status = 'active'/);
});
