import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const c=readFileSync(new URL('./paid-deployment.controller.ts',import.meta.url),'utf8');
test('paid access is never cached',()=>{
 assert.match(c,/@Header\('Cache-Control', 'private, no-store, max-age=0'\)/);
 assert.match(c,/@Header\('Pragma', 'no-cache'\)/);
});
test('provider authorization cannot be substituted by browser or cached metadata',()=>{
 assert.match(c,/currentContext\(\)/);
 assert.match(c,/assertRuntimeDeploymentTenant/);
 assert.match(c,/Paddle entitlement integration not accepted/);
 assert.doesNotMatch(c,/@Body|@Query|req\.headers|return\s*\{\s*deploymentId:/);
});
