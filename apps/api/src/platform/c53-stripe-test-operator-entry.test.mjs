import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripeTestOperatorAllowed } from './stripe-test-operator-policy.ts';

const env = Object.freeze({
  DEPLOYMENT_ENV: 'staging', STRIPE_TEST_OPERATOR_ENABLED: 'true',
  STRIPE_RECURRING_CHECKOUT_ENABLED: 'true', STRIPE_ENABLED: 'true',
  STRIPE_SECRET_KEY: 'sk_test_' + 'A'.repeat(24),
  STRIPE_WEBHOOK_SECRET: 'whsec_' + 'B'.repeat(24),
  STRIPE_WEBHOOK_PUBLIC_URL: 'https://api-staging.theepmo.com/api/v1/billing/stripe-webhook',
  STRIPE_TEST_OPERATOR_SECRET: 'C'.repeat(48),
});
const denied = (patch, credential = env.STRIPE_TEST_OPERATOR_SECRET) =>
  stripeTestOperatorAllowed({ ...env, ...patch }, credential);

test('C53 operator access requires every explicit staging-only TEST gate', () => {
  assert.equal(denied({}), true);
  for (const [key, value] of [
    ['DEPLOYMENT_ENV', 'production'], ['DEPLOYMENT_ENV', 'development'],
    ['STRIPE_TEST_OPERATOR_ENABLED', 'false'],
    ['STRIPE_RECURRING_CHECKOUT_ENABLED', 'false'],
    ['STRIPE_ENABLED', 'false'],
    ['STRIPE_SECRET_KEY', 'sk_live_' + 'A'.repeat(24)],
    ['STRIPE_SECRET_KEY', ''], ['STRIPE_WEBHOOK_SECRET', ''],
    ['STRIPE_TEST_OPERATOR_SECRET', 'short'],
    ['STRIPE_WEBHOOK_PUBLIC_URL', 'http://api-staging.theepmo.com/api/v1/billing/stripe-webhook'],
    ['STRIPE_WEBHOOK_PUBLIC_URL', 'https://theepmo.com/api/v1/billing/stripe-webhook'],
    ['STRIPE_WEBHOOK_PUBLIC_URL', 'https://staging.theepmo.com/api/v1/billing/stripe-webhook'],
    ['STRIPE_WEBHOOK_PUBLIC_URL', 'https://api-staging.theepmo.com.evil.example/api/v1/billing/stripe-webhook'],
    ['STRIPE_WEBHOOK_PUBLIC_URL', 'https://api-staging.theepmo.com/api/v1/billing/stripe-webhook?secret=x'],
    ['STRIPE_WEBHOOK_PUBLIC_URL', 'https://api-staging.theepmo.com/api/v1/billing/stripe-webhook/'],
  ]) assert.equal(denied({ [key]: value }), false, key);
});

test('C53 denies missing, mismatched, repeated, malformed and nonstring operator credentials', () => {
  for (const credential of [undefined, null, ['C'.repeat(48)], 'C'.repeat(47),
    'D'.repeat(48), 'C'.repeat(48) + '\n', 'sk_test_' + 'A'.repeat(24), 'C'.repeat(129)]) {
    assert.equal(stripeTestOperatorAllowed(env, credential), false);
  }
});

test('C53 operator secret remains separate from explicitly switched-off customer TEST entry', () => {
  const controller = readFileSync(new URL('./stripe-test-operator.controller.ts', import.meta.url), 'utf8');
  const billing = readFileSync(new URL('./billing.controller.ts', import.meta.url), 'utf8');
  const service = readFileSync(new URL('./stripe.service.ts', import.meta.url), 'utf8');
  const module = readFileSync(new URL('./platform.module.ts', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../app.module.ts', import.meta.url), 'utf8');
  assert.match(controller, /@Controller\('api\/v1\/subscription\/billing\/stripe\/operator'\)/);
  assert.match(controller, /@Post\('recurring-checkout'\)/);
  assert.match(controller, /requireCapability\('pmoa_admin'\)/);
  assert.match(controller, /req\.secure !== true/);
  assert.match(controller, /Object\.keys\(req\.body\)\.length !== 0/);
  assert.match(controller, /stripeTestOperatorAllowed\(process\.env, req\.headers\['x-epmo-stripe-test-operator-key'\]\)/);
  assert.match(controller, /this\.stripe\.prepareRecurringCheckout\(\)/);
  assert.match(module, /controllers: \[.*StripeTestOperatorController/);
  assert.match(billing, /@Post\('stripe\/recurring-checkout'\)/);
  assert.match(billing, /process\.env\.DEPLOYMENT_ENV !== 'staging'/);
  assert.match(billing, /process\.env\.NODE_ENV !== 'production'/);
  assert.match(billing, /STRIPE_RECURRING_CUSTOMER_CHECKOUT_ENABLED !== 'true'/);
  assert.match(billing, /new ServiceUnavailableException\('Customer TEST checkout is disabled'\)/);
  assert.match(billing, /this\.stripe\.prepareRecurringCheckout\(\)/);
  assert.doesNotMatch(billing, /x-epmo-stripe-test-operator-key/);
  const method = service.slice(service.indexOf('async prepareRecurringCheckout()'),
    service.indexOf('/** Authenticated customer administrator creates hosted checkout'));
  assert.match(method, /requireCapability\('pmoa_admin'\)/);
  assert.match(method, /config\.liveMode \|\| process\.env\.DEPLOYMENT_ENV === 'production'/);
  assert.match(method, /pg_advisory_xact_lock/);
  assert.match(method, /paymentVerified: false/);
  assert.doesNotMatch(method, /UPDATE tenant_subscriptions|INSERT INTO billing_payments/);
  assert.doesNotMatch(app, /exclude\([^)]*stripe\/operator\/recurring-checkout/s);
});
