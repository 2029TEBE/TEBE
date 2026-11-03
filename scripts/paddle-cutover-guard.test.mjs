import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const env=read('apps/api/src/common/env.ts');
const provider=read('apps/api/src/platform/stripe.service.ts');
const billing=read('apps/api/src/platform/billing.controller.ts');
const operator=read('apps/api/src/platform/stripe-test-operator.controller.ts');
const subscriptions=read('apps/api/src/platform/subscription.controller.ts');
const paid=read('apps/api/src/platform/paid-deployment.controller.ts');
const page=read('apps/web/src/app/(app)/billing/page.tsx');
const checkout=read('apps/web/src/app/api/billing/checkout/route.ts');
const subscription=read('apps/web/src/app/api/billing/subscription/route.ts');
const conf=['.env.example','.env.staging.example','.env.prod.example'];
test('selected Paddle provider stays OFF pending signed durable ledger; conflicting legacy flags denied',()=>{
 assert.match(env,/BILLING_PROVIDER: z\.enum\(\['none','paddle','stripe'\]\)/);
 assert.match(env,/PADDLE_ENABLED === 'true'/);
 assert.match(env,/Stripe checkout must remain disabled after Paddle selection/);
 assert.match(env,/Paddle payment collection is blocked pending signed webhook/);
 for(const name of conf){
  const text=read(name);
  assert.match(text,/BILLING_PROVIDER=paddle/);
  assert.match(text,/PADDLE_ENABLED=false/);
  assert.match(text,/STRIPE_ENABLED=false/);
  assert.doesNotMatch(text,/STRIPE_ENABLED=true|STRIPE_SECRET_KEY=sk_|PADDLE_API_KEY=pdl_/);
 }
});
test('old Stripe endpoints and UI are blocked for Paddle-selected deployments',()=>{
 assert.match(provider,/Legacy Stripe billing retired for the Paddle cutover/);
 assert.match(billing,/Legacy Stripe webhook disabled after provider cutover/);
 assert.match(operator,/Legacy Stripe TEST operator is retired/);
 assert.match(checkout,/process\.env\.BILLING_PROVIDER === 'paddle'/);
 assert.match(subscription,/process\.env\.BILLING_PROVIDER === 'paddle'/);
 assert.match(page,/const paddleMigration = process\.env\.BILLING_PROVIDER === 'paddle'/);
 assert.match(page,/!paddleMigration &&.*invoiceView\.canCheckout/);
 // E83 deliberately replaced the old Paddle-only message with a stricter
 // explicit-Stripe-and-enabled guard. Assert the actual authorization boundary,
 // not a stale error string; unknown/missing providers must also fail closed.
 assert.match(paid,/process\.env\.BILLING_PROVIDER !== 'stripe'/);
 assert.match(paid,/process\.env\.STRIPE_ENABLED !== 'true'/);
 assert.match(paid,/Provider-specific entitlements are not integrated or enabled/);
 assert.match(subscriptions,/Provider-managed cancellation is not configured/);
 assert.match(billing,/Renewal invoicing is disabled during Paddle migration/);
});
test('migration never interprets checkout signup link as paid transaction',()=>{
 for(const name of conf) assert.doesNotMatch(read(name),/PADDLE_ENABLED=true/);
 assert.doesNotMatch(page,/login\.paddle\.com\/signup/);
});
