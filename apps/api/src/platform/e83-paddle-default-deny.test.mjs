import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./paid-deployment.controller.ts', import.meta.url), 'utf8');

test('missing or Paddle-selected billing provider cannot fall through to historical Stripe paid rows', () => {
  assert.match(source, /process\.env\.BILLING_PROVIDER !== 'stripe'/);
  assert.match(source, /process\.env\.STRIPE_ENABLED !== 'true'/);
  assert.match(source, /throw new Error\('Provider-specific entitlements are not integrated or enabled'\)/);
});

test('paid access remains authenticated, tenant-scoped, and generic-denial on failure', () => {
  assert.match(source, /const \{ tenantId, userId \} = currentContext\(\)/);
  assert.match(source, /withTenant\(tenantId,/);
  assert.match(source, /p\.provider = 'stripe'/);
  assert.match(source, /r\.provider = 'stripe'/);
  assert.match(source, /throw new ForbiddenException\('Access unavailable'\)/);
});
