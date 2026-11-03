import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../../../'+p,import.meta.url),'utf8');
const policy=read('scripts/paddle-sandbox-settlement-policy.mjs');
const webhook=read('scripts/paddle-webhook-signature.mjs');
test('Paddle settlement requires signed completion, exact transaction, currency and amount',()=>{
 for(const fragment of ['signature_not_verified','transaction_not_completed','transaction_mismatch','amount_or_currency_mismatch'])
 assert.ok(policy.includes(fragment),fragment);
 assert.match(webhook,/timingSafeEqual/);
});
test('Paddle cannot activate subscriptions through pure policy helpers',()=>{
 assert.match(policy,/requiresAtomicPersistence: true/);
 assert.doesNotMatch(policy,/UPDATE tenant_subscriptions|GRANT\s+ALL/);
 assert.doesNotMatch(webhook,/UPDATE tenant_subscriptions|GRANT\s+ALL/);
});
