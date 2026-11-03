import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('./paid-deployment.controller.ts', import.meta.url), 'utf8');

test('paid deployment authorization responses must never be cached after revocation', () => {
  assert.match(controller, /@Header\('Cache-Control', 'private, no-store, max-age=0'\)/);
  assert.match(controller, /@Header\('Pragma', 'no-cache'\)/);
  assert.match(controller, /@Get\('paid-access'\)/);
});

test('cached deployment metadata cannot substitute for live tenant and payment checks', () => {
  assert.match(controller, /currentContext\(\)/);
  assert.match(controller, /assertRuntimeDeploymentTenant\(runtime, \{ tenantId, userId \}\)/);
  assert.match(controller, /withTenant\(tenantId,/);
  assert.match(controller, /s\.period_ends_at > now\(\)/);
  assert.match(controller, /JOIN billing_webhook_receipts r/);
  assert.doesNotMatch(controller, /@Headers|@Query|@Body|req\.headers|x-tenant-id/);
});
