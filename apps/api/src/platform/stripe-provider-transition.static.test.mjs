/**
 * Offline source guards for the provider transition. These are NOT Stripe
 * API tests and cannot certify live charge or webhook delivery.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const read=p=>readFileSync(resolve(here,p),'utf8');
const stripe=read('stripe.service.ts');
const reference=read('billing.service.ts');
const controller=read('billing.controller.ts');
const preflight=read('../../../../scripts/stripe-staging-preflight.mjs');
const env=read('../../../../.env.example');
const web=read('../../../web/src/app/api/billing/checkout/route.ts');

test('future Stripe Checkout requires deliberate Stripe-only mode and secrets',()=>{
  assert.match(stripe,/process\.env\.BILLING_PROVIDER !== 'stripe'/);
  assert.match(stripe,/process\.env\.STRIPE_ENABLED !== 'true'/);
  assert.match(stripe,/STRIPE_SECRET_KEY/);
  assert.match(stripe,/STRIPE_WEBHOOK_SECRET/);
  assert.match(stripe,/stripeDeploymentModeAllowed/);
  assert.match(env,/BILLING_PROVIDER=stripe/);
  assert.match(env,/STRIPE_ENABLED=false/);
});

test('Stripe-only mode refuses reference settlement, and paid status requires signed webhooks',()=>{
  assert.match(reference,/process\.env\.BILLING_PROVIDER === 'stripe'/);
  assert.match(reference,/BILLING_REFERENCE_WEBHOOK_ENABLED/);
  assert.match(stripe,/verifyStripeSignature/);
  assert.match(stripe,/assertStripeSettlement/);
  assert.match(controller,/@Post\('stripe-webhook'\)/);
  assert.match(controller,/@Post\('stripe\/checkout'\)/);
});

test('frontend checkout is Stripe-hosted and staging preflight checks provider mode',()=>{
  assert.match(web,/api\/v1\/subscription\/billing\/stripe\/checkout/);
  assert.match(web,/checkout\.stripe\.com/);
  assert.match(preflight,/Stripe-only billing provider selected/);
  assert.match(preflight,/env\.BILLING_PROVIDER === 'stripe'/);
  assert.match(preflight,/Reference webhook disabled/);
});

test('cancelled Stripe Checkout return matches billing page status',()=>{
 const billing=read('../../../web/src/app/(app)/billing/page.tsx');
 assert.match(stripe,/billing\?billing=cancel`/);
 assert.match(billing,/billing === 'cancel'/);
 assert.doesNotMatch(stripe,/billing\?billing=cancelled`/);
});

test('no automatic recurring subscription claim in one-off payment flow',()=>{
  assert.match(stripe,/createCheckout\(invoiceId: string\)/);
  const policy=read('stripe-policy.ts');
  assert.match(policy,/mode: 'payment'/);
  assert.doesNotMatch(policy,/mode: 'subscription'/);
});
