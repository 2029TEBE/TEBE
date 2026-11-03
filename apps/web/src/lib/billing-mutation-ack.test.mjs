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
    new Response(JSON.stringify({ value: 'x'.repeat(17000) }), { headers: { 'content-type': 'application/json' } }),
    new Response(JSON.stringify(invoice), { headers: { 'content-type': 'text/plain' } }),
    new Response(JSON.stringify(invoice), { status: 403, headers: { 'content-type': 'application/json' } }),
  ]) assert.equal(await readBillingMutationJson(response), null);
  const redirected = json(invoice);
  Object.defineProperty(redirected, 'redirected', { value: true });
  assert.equal(await readBillingMutationJson(redirected), null);
});
test('both customer mutation endpoints reject all payments while Paddle integration is incomplete',()=>{
 for(const route of ['checkout','subscription']){
  const source=readFileSync(new URL('../app/api/billing/'+route+'/route.ts',import.meta.url),'utf8');
  assert.match(source,/rejectUnsafeBrowserMutation\(req\)/);
  assert.match(source,/status: 503/);
  assert.match(source,/Cache-Control': 'no-store'/);
  assert.doesNotMatch(source,/paymentVerified:\s*true|entitlementGranted:\s*true/);
 }
});
test('billing UI does not claim success from query parameters',()=>{
 const source=readFileSync(new URL('../app/(app)/billing/page.tsx',import.meta.url),'utf8');
 assert.match(source,/Paddle is our billing provider/);
 assert.doesNotMatch(source,/success === '1'|updated === '1'|Renewal invoice created or found\./);
});
