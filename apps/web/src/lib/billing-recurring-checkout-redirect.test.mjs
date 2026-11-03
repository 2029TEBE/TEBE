import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripeRecurringCheckoutRedirect } from './billing-recurring-checkout-redirect.mjs';

const tenantSubscription = '4cd933a7-073d-4bb6-9410-bcad2a2a0011';
const plan = '1595aa4a-ea6b-45f4-ab27-fef18a0a4dfd';
const now = Date.parse('2026-11-03T12:00:00.000Z');
const payload = Object.freeze({
  subscriptionId: tenantSubscription, planId: plan, sessionId: 'cs_test_First0001',
  url: 'https://checkout.stripe.com/c/pay/cs_test_First0001#fragment',
  expiresAt: new Date(now + 2 * 3_600_000).toISOString(),
  recurring: true, paymentVerified: false,
});

test('validated TEST-only recurring provider URL is navigation, not payment proof', () => {
  assert.equal(stripeRecurringCheckoutRedirect(payload, now)?.hostname, 'checkout.stripe.com');
  assert.equal(stripeRecurringCheckoutRedirect({
    ...payload, url: 'https://checkout.stripe.com/pay/cs_test_First0001?locale=ar',
  }, now)?.pathname, '/pay/cs_test_First0001');
});

test('rejects live sessions, redirects, forged entitlement and stale references', () => {
  for (const value of [
    null, {}, [], { ...payload, recurring: false },
    { ...payload, paymentVerified: true }, { ...payload, paymentVerified: undefined },
    { ...payload, planId: 'invalid' }, { ...payload, subscriptionId: 'invalid' },
    { ...payload, sessionId: 'cs_live_First0001' },
    { ...payload, url: 'https://checkout.stripe.com/c/pay/cs_live_First0001' },
    { ...payload, url: 'https://checkout.stripe.com/c/pay/cs_test_Else' },
    { ...payload, url: 'https://attacker@checkout.stripe.com/c/pay/cs_test_First0001' },
    { ...payload, url: 'http://checkout.stripe.com/c/pay/cs_test_First0001' },
    { ...payload, url: 'https://checkout.stripe.com.evil.test/c/pay/cs_test_First0001' },
    { ...payload, url: 'https://checkout.stripe.com:8443/c/pay/cs_test_First0001' },
    { ...payload, expiresAt: new Date(now - 1000).toISOString() },
    { ...payload, expiresAt: new Date(now + 3 * 86_400_000).toISOString() },
  ]) assert.equal(stripeRecurringCheckoutRedirect(value, now), null);
});

test('customer route retains anti-CSRF session checks and never confirms first payment on redirect', () => {
  const proxy = readFileSync(new URL('../app/api/billing/checkout/route.ts', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../app/(app)/billing/page.tsx', import.meta.url), 'utf8');
  assert.match(proxy, /rejectUnsafeBrowserMutation\(req\)/);
  assert.match(proxy, /fetchTenantMutation\(fetch,/);
  assert.match(proxy, /stripeRecurringCheckoutRedirect\(data\)/);
  assert.match(proxy, /billingFailurePath\(502\)/);
  assert.match(proxy, /action === 'first-checkout'/);
  assert.match(page, /process\.env\.DEPLOYMENT_ENV === 'staging'/);
  assert.match(page, /STRIPE_RECURRING_CHECKOUT_ENABLED === 'true'/);
  assert.match(page, /subscription\?\.status === 'trialing'/);
  assert.match(page, /status === 'expired'/);
  assert.match(page, /name="action" value="first-checkout"/);
  assert.match(page, /Stripe TEST subscription/);
  assert.doesNotMatch(proxy, /status\s*=\s*'active'/);
});
