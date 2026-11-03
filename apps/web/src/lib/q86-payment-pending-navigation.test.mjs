import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const billing=readFileSync(new URL('../app/(app)/billing/page.tsx',import.meta.url),'utf8');
const pending=readFileSync(new URL('../app/(app)/billing/payment-pending/page.tsx',import.meta.url),'utf8');
const controller=readFileSync(new URL('../../../api/src/platform/paid-deployment.controller.ts',import.meta.url),'utf8');
test('Q86: payment return is navigation only and never a license grant',()=>{
 assert.match(billing,/Paddle is our billing provider/);
 assert.match(pending,/redirect\('\/billing\/verification'\)/);
 assert.doesNotMatch(pending,/setCookie|sessionStorage|localStorage|paymentVerified:\s*true/);
});
test('Q86: server refuses unverified entitlements',()=>{
 assert.match(controller,/Paddle entitlement integration not accepted/);
 assert.match(controller,/ForbiddenException\('Access unavailable'\)/);
 assert.doesNotMatch(controller,/return\s*\{\s*deploymentId:/);
});
