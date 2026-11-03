import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const c=readFileSync(new URL('./paid-deployment.controller.ts',import.meta.url),'utf8');
test('paid-access contains no legacy provider SQL grant path',()=>{
 assert.doesNotMatch(c,/JOIN billing_payments|billing_webhook_receipts|UPDATE tenant_subscriptions/);
 assert.doesNotMatch(c,/return\s*\{\s*deploymentId:/);
});
test('paid-access refuses all requests without signed, committed Paddle proof',()=>{
 assert.match(c,/Paddle entitlement integration not accepted/);
 assert.match(c,/ForbiddenException\('Access unavailable'\)/);
});
