import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
const controller=read('./billing.controller.ts'),module=read('./platform.module.ts');
const verifier=readFileSync(new URL('../../../../scripts/paddle-webhook-signature.mjs',import.meta.url),'utf8');
test('customer billing is read-only and rejects premature checkout',()=>{
 assert.match(controller,/@Controller\('api\/v1\/subscription\/billing'\)/);
 assert.match(controller,/@Get\('invoices'\)/);
 assert.match(controller,/@Post\('renewal-invoice'\)/);
 assert.match(controller,/requireCapability\('pmoa_admin'\)/);
 assert.match(controller,/ServiceUnavailableException/);
 assert.doesNotMatch(controller,/@Post\('.*checkout/);
});
test('Paddle callback is deliberately not acknowledged until persistence exists',()=>{
 assert.match(controller,/@Post\('paddle-webhook'\)/);
 assert.match(controller,/throw new ServiceUnavailableException\('Paddle settlement webhook not yet enabled'\)/);
 assert.match(module,/BillingWebhookController/);
 assert.match(verifier,/verifyPaddleSignature/);
 assert.doesNotMatch(controller,/paymentVerified:\s*true|UPDATE tenant_subscriptions/);
});
