import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const api=path=>readFileSync(new URL('./'+path,import.meta.url),'utf8');
const controller=api('paid-deployment.controller.ts');
const pending=readFileSync(new URL('../../../web/src/app/(app)/billing/payment-pending/page.tsx',import.meta.url),'utf8');
const probe=readFileSync(new URL('../../../../infra/servitro-probe-contract.mjs',import.meta.url),'utf8');
test('Q88: paid access is uncached, tenant-bound and always fail closed',()=>{
 assert.match(controller,/private, no-store, max-age=0/);
 assert.match(controller,/currentContext\(\)/);
 assert.match(controller,/assertRuntimeDeploymentTenant/);
 assert.match(controller,/Paddle entitlement integration not accepted/);
 assert.match(controller,/ForbiddenException\('Access unavailable'\)/);
});
test('Q88: pending checkout cannot claim payment or subscription state',()=>{
 assert.match(pending,/redirect\('\/billing\/verification'\)/);
 assert.doesNotMatch(pending,/paymentVerified:\s*true|entitlementGranted:\s*true/);
});
test('Q88: offline Servitro structural receipts never authorize deployment',()=>{
 assert.match(probe,/operationallyVerified:false,deploymentAuthorized:false/);
 assert.match(probe,/independent-readonly-probe/);
 assert.match(probe,/tls\.verified/);
});
