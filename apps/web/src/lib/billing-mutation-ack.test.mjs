import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readBillingMutationJson, isRenewalInvoiceAcknowledged, isSubscriptionPreferenceAcknowledged } from './billing-mutation-ack.mjs';

const id = '00000000-0000-4000-8000-000000000001';
const invoice = { invoiceId: id, status: 'open', amountMinor: 1000, currency: 'SAR', paymentVerified: false };
const subscription = { id, cancelAtPeriodEnd: true };
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

test('valid tenant-scoped invoice acknowledgement is not a payment receipt', async () => {
  const payload = await readBillingMutationJson(json(invoice));
  assert.equal(isRenewalInvoiceAcknowledged(payload), true);
  assert.equal(isRenewalInvoiceAcknowledged({ ...payload, paymentVerified: true }), false);
  assert.equal(isRenewalInvoiceAcknowledged({ ...payload, invoiceId: 'not-uuid' }), false);
  assert.equal(isRenewalInvoiceAcknowledged({ ...payload, amountMinor: -1 }), false);
});
test('subscription acknowledgement must match requested cancellation state', async () => {
  assert.equal(isSubscriptionPreferenceAcknowledged(await readBillingMutationJson(json(subscription)), true), true);
  assert.equal(isSubscriptionPreferenceAcknowledged(subscription, false), false);
  assert.equal(isSubscriptionPreferenceAcknowledged({ ...subscription, unchanged: true }, true), true);
  assert.equal(isSubscriptionPreferenceAcknowledged({ ...subscription, id: 'wrong' }, true), false);
});
test('200 HTML login, invalid JSON, oversized body, redirects and non-JSON all fail closed', async () => {
  for (const response of [
    new Response('<html>Sign in</html>', { headers: { 'content-type': 'text/html' } }),
    new Response('{bad', { headers: { 'content-type': 'application/json' } }),
    new Response(JSON.stringify({ value: 'x'.repeat(5000) }), { headers: { 'content-type': 'application/json' } }),
    new Response(JSON.stringify(invoice), { headers: { 'content-type': 'text/plain' } }),
    new Response(JSON.stringify(invoice), { status: 403, headers: { 'content-type': 'application/json' } }),
  ]) assert.equal(await readBillingMutationJson(response), null);
  const redirected = json(invoice);
  Object.defineProperty(redirected, 'redirected', { value: true });
  assert.equal(await readBillingMutationJson(redirected), null);
});
test('both billing proxies require bounded, contract-matching JSON before redirecting success', () => {
  const checkout = readFileSync(new URL('../app/api/billing/checkout/route.ts', import.meta.url), 'utf8');
  const subscriptionRoute = readFileSync(new URL('../app/api/billing/subscription/route.ts', import.meta.url), 'utf8');
  assert.match(checkout, /readBillingMutationJson\(response\)/);
  assert.match(checkout, /isRenewalInvoiceAcknowledged\(data\)/);
  assert.match(subscriptionRoute, /readBillingMutationJson\(response\)/);
  assert.match(subscriptionRoute, /isSubscriptionPreferenceAcknowledged\(data, action === 'schedule-cancellation'\)/);
  assert.doesNotMatch(checkout, /response\.json\(\)/);
});
test('billing page never claims a confirmed change from a forgeable URL query flag', () => {
  const source = readFileSync(new URL('../app/(app)/billing/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /success === '1'/);
  assert.match(source, /updated === '1'/);
  assert.match(source, /this URL does not confirm an invoice or payment/);
  assert.match(source, /this URL does not confirm cancellation or resumption/);
  assert.doesNotMatch(source, /Renewal invoice created or found\./);
  assert.doesNotMatch(source, /Subscription preference updated\./);
});
