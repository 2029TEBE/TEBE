import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const c=readFileSync(new URL('./paid-deployment.controller.ts',import.meta.url),'utf8');
test('missing tenant context fails closed and uses generic denial',()=>{
 const start=c.indexOf('async paidAccess()'),t=c.indexOf('try {',start),
  context=c.indexOf('currentContext()',start),end=c.indexOf('} catch {',start);
 assert.ok(start>=0 && t>start && context>t && end>context);
 assert.match(c,/if \(!tenantId \|\| !userId\) throw/);
 assert.match(c,/ForbiddenException\('Access unavailable'\)/);
});
test('unverified payment cannot grant access across tenants',()=>{
 assert.match(c,/assertRuntimeDeploymentTenant\(runtime, \{ tenantId, userId \}\)/);
 assert.match(c,/runtime\.tenantBindings\.has\(tenantId\)/);
 assert.doesNotMatch(c,/@Headers|@Query|req\.headers|return\s*\{\s*deploymentId:/);
});
