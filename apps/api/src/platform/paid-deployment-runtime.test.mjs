import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const c=readFileSync(new URL('./paid-deployment.controller.ts',import.meta.url),'utf8');
const moduleSource=readFileSync(new URL('./platform.module.ts',import.meta.url),'utf8');
test('runtime registers a private paid-access controller',()=>{
 assert.match(moduleSource,/controllers:\s*\[PaidDeploymentController,/);
 assert.match(c,/@Controller\('api\/v1\/platform\/deployment'\)/);
 assert.match(c,/@Get\('paid-access'\)/);
 assert.match(c,/private, no-store, max-age=0/);
});
test('tenant and deployment identity are verified from authenticated context',()=>{
 assert.match(c,/currentContext\(\)/);
 assert.match(c,/if \(!tenantId \|\| !userId\) throw/);
 assert.match(c,/assertRuntimeDeploymentTenant\(runtime, \{ tenantId, userId \}\)/);
 assert.match(c,/runtime\.tenantBindings\.has\(tenantId\)/);
 assert.doesNotMatch(c,/@Headers|@Query|@Body|req\.headers|x-tenant-id/);
});
test('unverified provider payment can never return an entitlement',()=>{
 assert.match(c,/Paddle entitlement integration not accepted/);
 assert.match(c,/throw new ForbiddenException\('Access unavailable'\)/);
 assert.doesNotMatch(c,/return\s*\{\s*deploymentId:|status\s*=\s*'active'/);
});
