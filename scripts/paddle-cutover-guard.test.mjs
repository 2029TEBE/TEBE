import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const env=read('apps/api/src/common/env.ts');
const billing=read('apps/api/src/platform/billing.controller.ts');
const app=read('apps/api/src/platform/platform.module.ts');
const page=read('apps/web/src/app/(app)/billing/page.tsx');
const checkout=read('apps/web/src/app/api/billing/checkout/route.ts');
const subscription=read('apps/web/src/app/api/billing/subscription/route.ts');
test('Paddle is the only selectable active provider',()=>{
 assert.match(env,/BILLING_PROVIDER: z\.literal\('paddle'\)/);
 assert.match(env,/Paddle collection is blocked pending signed webhook/);
 assert.doesNotMatch(env,/STRIPE_/);
 for(const path of ['.env.example','.env.prod.example','.env.staging.example']){
  const c=read(path);
  assert.match(c,/BILLING_PROVIDER=paddle/);
  assert.match(c,/PADDLE_ENABLED=false/);
  assert.doesNotMatch(c,/STRIPE_/);
 }
});
test('obsolete provider routes and services are disconnected',()=>{
 assert.doesNotMatch(app,/StripeBillingService|StripeTestOperatorController/);
 assert.doesNotMatch(billing,/stripe-webhook|stripe\/checkout/i);
 assert.match(billing,/paddle-webhook/);
 assert.match(checkout,/503/);
 assert.match(subscription,/503/);
 assert.match(page,/Paddle is our billing provider/);
});
test('billing return never grants payment or entitlement',()=>{
 assert.doesNotMatch(checkout,/paymentVerified:\s*true|entitlementGranted:\s*true/);
 assert.doesNotMatch(subscription,/paymentVerified:\s*true|entitlementGranted:\s*true/);
 assert.match(page,/Verify subscription status/);
});
