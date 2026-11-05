import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {verifyPaddleSignature,paddleEventIdentity} from './paddle-webhook-signature.mjs';
import {evaluatePaddleSandboxSettlement as settle} from './paddle-sandbox-settlement-policy.mjs';
import {evaluatePaddleLifecycle as lifecycle} from './paddle-sandbox-lifecycle-policy.mjs';

const tenant='11111111-1111-4111-8111-111111111111';
const subscription='22222222-2222-4222-8222-222222222222';
const eventId='evt_'+'a'.repeat(26), time=1793736000;
const key='pdl_ntfset_synthetic_test_not_a_real_secret';
const intent=()=>({provider:'paddle',environment:'sandbox',tenantId:tenant,
 subscriptionId:subscription,transactionId:'txn_abc123',
 priceId:'pri_abc123',amountMinor:11500,currency:'SAR',expiresAt:time*1000+100000});
const event=()=>({event_id:eventId,event_type:'transaction.completed',data:{
 id:'txn_abc123',status:'completed',subscription_id:'sub_abc123',currency_code:'SAR',
 custom_data:{tenantId:tenant},details:{
 line_items:[{price_id:'pri_abc123',quantity:1}],
 totals:{grand_total:'11500'}}}});
const raw=value=>Buffer.from(JSON.stringify(value));
const signature=buf=>'ts='+time+';h1='+createHmac('sha256',key).update(String(time)+':').update(buf).digest('hex');
const check=(value=event(),custom=intent())=>{
 const bytes=raw(value),sig=signature(bytes);
 const verified=verifyPaddleSignature(bytes,sig,key,time);
 const identity=paddleEventIdentity(bytes,sig,key,time);
 return settle(value,custom,{signatureVerified:verified&&!!identity,now:time*1000});
};
test('scenario 1: signed completed transaction is persistence-only, never a license grant',()=>{
 const result=check();
 assert.equal(result.accepted,true);assert.equal(result.requiresAtomicPersistence,true);
 assert.equal(Object.hasOwn(result,'entitlementGranted'),false);
});
test('scenario 2: unsigned or tampered transaction is rejected before settlement',()=>{
 const good=raw(event()),changed=raw({...event(),data:{...event().data,currency_code:'USD'}});
 assert.equal(verifyPaddleSignature(changed,signature(good),key,time),false);
 assert.equal(settle(event(),intent(),{signatureVerified:false,now:time*1000}).accepted,false);
});
test('scenario 3: cross-tenant and foreign transaction receipts cannot be accepted',()=>{
 const foreign=event();foreign.data.custom_data.tenantId='other-tenant';
 assert.equal(check(foreign).accepted,false);
 const mismatched=event();mismatched.data.id='txn_other';
 assert.equal(check(mismatched).accepted,false);
});
test('scenario 4: wrong price, quantity, amount or currency cannot be settled',()=>{
 for(const field of ['price','quantity','amount','currency']){
  const e=event();
  if(field==='price')e.data.details.line_items[0].price_id='pri_other';
  if(field==='quantity')e.data.details.line_items[0].quantity=2;
  if(field==='amount')e.data.details.totals.grand_total='11499';
  if(field==='currency')e.data.currency_code='USD';
  assert.equal(check(e).accepted,false,field);
 }
});
test('scenario 5: pending or expired events and intents cannot confirm payment',()=>{
 const pending=event();pending.data.status='billed';
 assert.equal(check(pending).accepted,false);
 assert.equal(check(event(),{...intent(),expiresAt:time*1000-1}).accepted,false);
});
test('scenario 6: lifecycle cancellations and past-due states never grant access',()=>{
 for(const [type,status] of [['subscription.canceled','canceled'],['subscription.past_due','past_due']]){
  const value=lifecycle({event_id:eventId,event_type:type,data:{id:'sub_abc123',
    status,updated_at:'2026-11-05T10:00:00Z'}},
    {provider:'paddle',environment:'sandbox',tenantId:tenant,subscriptionId:subscription,
      providerSubscriptionId:'sub_abc123'},{signatureVerified:true});
  assert.equal(value.accepted,true);assert.equal(value.grantEntitlement,false);
 }
});
test('scenario 7: stale out-of-order lifecycle notification is rejected',()=>{
 const binding={provider:'paddle',environment:'sandbox',tenantId:tenant,
 subscriptionId:subscription,providerSubscriptionId:'sub_abc123',
 lastProviderUpdatedAt:'2026-11-05T11:00:00Z',
 lastProviderStatus:'canceled',lastProviderEventId:eventId};
 const val=lifecycle({event_id:'evt_'+'b'.repeat(26),event_type:'subscription.updated',
  data:{id:'sub_abc123',status:'active',updated_at:'2026-11-05T10:00:00Z'}},
  binding,{signatureVerified:true});
 assert.equal(val.reason,'stale_event');assert.equal(val.grantEntitlement,false);
});
test('scenario 8: refund/adjustment and duplicate receipts must not be marked paid by callbacks',()=>{
 const refund=raw({event_id:eventId,event_type:'adjustment.updated',data:{id:'adj_123'}});
 assert.equal(paddleEventIdentity(refund,signature(refund),key,time),null);
 const controller=readFileSync(new URL('../apps/api/src/platform/billing.controller.ts',import.meta.url),'utf8');
 assert.match(controller,/ServiceUnavailableException/);
 assert.match(controller,/@HttpCode\(200\)/);
 const intake=readFileSync(new URL('../apps/api/src/platform/paddle-webhook-intake.ts',import.meta.url),'utf8');
 assert.match(intake,/ensureDisposableWriter/);
 assert.match(intake,/grantEntitlement:false/);
 const docs=readFileSync(new URL('../docs/billing/P0_PADDLE_SANDBOX_ACCEPTANCE.md',import.meta.url),'utf8');
 assert.match(docs,/idempotent|replay/i);
});
