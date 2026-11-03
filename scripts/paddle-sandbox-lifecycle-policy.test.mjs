import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePaddleLifecycle as check } from './paddle-sandbox-lifecycle-policy.mjs';
const tenantId='11111111-1111-4111-8111-111111111111';
const subscriptionId='22222222-2222-4222-8222-222222222222';
const binding={provider:'paddle',environment:'sandbox',tenantId,subscriptionId,providerSubscriptionId:'sub_12345'};
const event={event_id:'evt_12345678901234567890',event_type:'subscription.updated',data:{id:'sub_12345',status:'active',updated_at:'2026-11-03T20:00:00Z'}};
test('signed lifecycle is not payment or entitlement evidence',()=>{
 const r=check(event,binding,{signatureVerified:true});
 assert.equal(r.accepted,true);assert.equal(r.grantEntitlement,false);
 assert.equal(r.requiresAtomicPersistence,true);assert.equal(r.requiresVerifiedSettlementForAccess,true);
});
test('unsigned, wrong provider, live environment, wrong subscription and tenant fail closed',()=>{
 assert.equal(check(event,binding).accepted,false);
 for(const patch of [{provider:'stripe'},{environment:'live'},{providerSubscriptionId:'sub_wrong'},{tenantId:'33333333-3333-4333-8333-333333333333'}]){
  const candidate={...binding,...patch};
  const e={...event,data:{...event.data,custom_data:{tenantId}}};
  assert.equal(check(e,candidate,{signatureVerified:true}).accepted,false);
 }
});
test('cancellation and past due may be persisted but never grant access',()=>{
 for(const [event_type,status] of [['subscription.canceled','canceled'],['subscription.past_due','past_due']]){
  const r=check({...event,event_type,data:{...event.data,status}},binding,{signatureVerified:true});
  assert.equal(r.accepted,true);assert.equal(r.grantEntitlement,false);
 }
});
test('status mismatch, malformed event and missing timestamp reject',()=>{
 for(const e of [{...event,event_type:'transaction.completed'}, {...event,event_type:'subscription.canceled',data:{...event.data,status:'active'}},
  {...event,data:{...event.data,updated_at:null}}, {...event,event_id:'evt_bad'}]){
  assert.equal(check(e,binding,{signatureVerified:true}).accepted,false);
 }
});

test('persisted tenant watermark rejects out-of-order and conflicting events',()=>{
 const watermark={...binding,lastProviderUpdatedAt:'2026-11-03T21:00:00Z',lastProviderStatus:'canceled'};
 assert.equal(check(event,watermark,{signatureVerified:true}).reason,'stale_event');
 const sameTime={...event,data:{...event.data,updated_at:'2026-11-03T21:00:00Z'}};
 assert.equal(check(sameTime,watermark,{signatureVerified:true}).reason,'conflicting_event');
 const sameState={...sameTime,data:{...sameTime.data,status:'canceled'}};
 const replay=check(sameState,watermark,{signatureVerified:true});
 assert.equal(replay.accepted,true);
 assert.equal(replay.isReplay,true);
 assert.equal(replay.grantEntitlement,false);
});
test('future lifecycle updates cannot be mistaken for paid settlement',()=>{
 const prior={...binding,lastProviderUpdatedAt:'2026-11-03T19:00:00Z',lastProviderStatus:'past_due'};
 const result=check(event,prior,{signatureVerified:true});
 assert.equal(result.accepted,true);
 assert.equal(result.isReplay,false);
 assert.equal(result.requiresAtomicPersistence,true);
 assert.equal(result.requiresVerifiedSettlementForAccess,true);
 assert.equal(result.grantEntitlement,false);
});
test('invalid persisted watermark and ambiguous timezone fail closed',()=>{
 assert.equal(check(event,{...binding,lastProviderUpdatedAt:'invalid'},{signatureVerified:true}).reason,'invalid_watermark');
 const ambiguous={...event,data:{...event.data,updated_at:'2026-11-03T20:00:00'}};
 assert.equal(check(ambiguous,binding,{signatureVerified:true}).reason,'missing_ordering');
});

test('subscription.updated accepts canceled status as an explicit lifecycle transition, never as settlement',()=>{
 const result=check({...event,data:{...event.data,status:'canceled'}},binding,{signatureVerified:true});
 assert.equal(result.accepted,true);
 assert.equal(result.providerStatus,'canceled');
 assert.equal(result.grantEntitlement,false);
 assert.equal(result.requiresVerifiedSettlementForAccess,true);
});
