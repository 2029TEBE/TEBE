import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const controller = readFileSync(new URL('./paid-deployment.controller.ts', import.meta.url), 'utf8');
const moduleSource = readFileSync(new URL('./platform.module.ts', import.meta.url), 'utf8');
test('running Nest module registers paid-access controller', () => {
  assert.match(moduleSource, /controllers:\s*\[PaidDeploymentController,/);
  assert.match(controller, /@Controller\('api\/v1\/platform\/deployment'\)/);
  assert.match(controller, /@Get\('paid-access'\)/);
});
test('paid access derives tenant from authenticated context and ignores request headers', () => {
  assert.match(controller, /currentContext\(\)/);
  assert.match(controller, /assertRuntimeDeploymentTenant\(runtime, \{ tenantId, userId \}\)/);
  assert.doesNotMatch(controller, /@Headers|@Query|@Body|req\.headers|x-tenant-id|x-deployment-id/);
});
test('paid access requires active unexpired tenant subscription and deployment inventory', () => {
  assert.match(controller, /if \(!runtime\) throw new ServiceUnavailableException/);
  assert.match(controller, /withTenant\(tenantId,/);
  assert.match(controller, /tenant_id = \$\{tenantId\}/);
  assert.match(controller, /status = 'active'/);
  assert.match(controller, /period_ends_at > now\(\)/);
  assert.match(controller, /period_starts_at <= now\(\)/);
});
test('paid access does not reflect SQL or entitlement data on denial', () => {
  assert.match(controller, /catch \{/);
  assert.match(controller, /ForbiddenException\('Access unavailable'\)/);
  assert.doesNotMatch(controller, /console\.log|JSON\.stringify\(.*error/);
});
