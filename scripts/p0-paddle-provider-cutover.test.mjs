import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('P0: only Paddle is selected and never enabled in environment templates', () => {
  for (const path of ['.env.example','.env.prod.example','.env.staging.example']) {
    const src=file(path);
    assert.match(src,/BILLING_PROVIDER=paddle/);
    assert.match(src,/PADDLE_ENABLED=false/);
    assert.doesNotMatch(src,/^STRIPE_(?:ENABLED|SECRET_KEY|WEBHOOK_SECRET|ALLOW_TEST_MODE_IN_PRODUCTION)=/m);
  }
  const compose=file('docker-compose.prod.yml');
  assert.match(compose,/BILLING_PROVIDER: paddle/);
  assert.match(compose,/PADDLE_ENABLED: 'false'/);
  assert.doesNotMatch(compose,/^\s*STRIPE_/m);
});

test('P0: API rejects legacy provider and Paddle charge enablement at boot', () => {
  const env=file('apps/api/src/common/env.ts');
  assert.match(env,/BILLING_PROVIDER: z\.literal\('paddle'\)/);
  assert.match(env,/process\.env\.STRIPE_ENABLED === 'true'/);
  assert.match(env,/env\.PADDLE_ENABLED === 'true'/);
  assert.match(env,/Paddle collection is disabled/);
});

test('P0: API billing has no reachable retired checkout or acknowledgement', () => {
  const ctrl=file('apps/api/src/platform/billing.controller.ts');
  const module=file('apps/api/src/platform/platform.module.ts');
  assert.doesNotMatch(ctrl,/stripe\/checkout|stripe-webhook|StripeBillingService/);
  assert.doesNotMatch(module,/StripeBillingService|stripe\.service/);
  assert.match(ctrl,/ServiceUnavailableException/);
  assert.match(ctrl,/@Post\('paddle-webhook'\)/);
  assert.doesNotMatch(ctrl,/@HttpCode\(200\)/);
  const subscription=file('apps/api/src/platform/subscription.controller.ts');
  assert.doesNotMatch(subscription,/setCancellation\(/);
  assert.match(subscription,/ServiceUnavailableException/);
});

test('P0: browser cannot redirect to checkout or locally change subscription', () => {
  for(const route of ['apps/web/src/app/api/billing/checkout/route.ts','apps/web/src/app/api/billing/subscription/route.ts']){
    const src=file(route);
    assert.match(src,/rejectUnsafeBrowserMutation/);
    assert.match(src,/status: 503/);
    assert.match(src,/Cache-Control.*no-store/);
    assert.doesNotMatch(src,/\bfetch\(|NextResponse\.redirect\(|checkout\.stripe\.com/);
  }
  const ui=file('apps/web/src/app/(app)/billing/page.tsx');
  assert.match(ui,/Paddle/);
  assert.doesNotMatch(ui,/<form|Pay securely with Stripe|checkout\.stripe\.com/);
});

test('P0: historical financial migrations are preserved', () => {
  const migration=file('packages/db/migrations/0015_stripe_checkout_sessions.sql');
  assert.ok(migration.length > 100, 'do not discard applied migration history');
});
