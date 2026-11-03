import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../../../../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const api=read('apps/api/src/platform/paid-deployment.controller.ts');
const policy=read('scripts/paddle-sandbox-settlement-policy.mjs');
const signature=read('scripts/paddle-webhook-signature.mjs');
test('Paddle entitlements deny access until verified durable settlement is integrated',()=>{
 assert.match(api,/currentContext\(\)/);
 assert.match(api,/assertRuntimeDeploymentTenant/);
 assert.match(api,/Paddle entitlement integration not accepted/);
 assert.match(api,/ForbiddenException\('Access unavailable'\)/);
 assert.doesNotMatch(api,/@Body|@Headers|req\.headers|paymentVerified/);
});
test('Paddle transport checks signed receipt, tenant binding and provider amounts',()=>{
 assert.match(signature,/verifyPaddleSignature/);
 for(const fragment of ['signature_not_verified','untrusted_intent','tenant_mismatch','amount_or_currency_mismatch','subscription_mismatch'])
 assert.ok(policy.includes(fragment),fragment);
 assert.match(policy,/requiresAtomicPersistence: true/);
});
