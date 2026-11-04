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
 const watermark={...binding,lastProviderUpdatedAt:'2026-11-03T21:00:00Z',lastProviderStatus:'canceled',lastProviderEventId:event.event_id};
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
 const prior={...binding,lastProviderUpdatedAt:'2026-11-03T19:00:00Z',lastProviderStatus:'past_due',lastProviderEventId:'evt_99999999999999999999'};
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

test('same timestamp and status requires the exact persisted provider event ID',()=>{
 const prior={...binding,lastProviderUpdatedAt:event.data.updated_at,lastProviderStatus:'active'};
 assert.equal(check(event,prior,{signatureVerified:true}).reason,'invalid_watermark');
 assert.equal(check(event,{...prior,lastProviderEventId:'evt_99999999999999999999'},{signatureVerified:true}).reason,'ambiguous_replay');
 const exact=check(event,{...prior,lastProviderEventId:event.event_id},{signatureVerified:true});
 assert.equal(exact.accepted,true);
 assert.equal(exact.isReplay,true);
 assert.equal(exact.grantEntitlement,false);
});

test('explicit malformed or empty tenant metadata cannot bypass server binding',()=>{
 for(const custom_data of [{tenantId:''},{tenantId:null},{tenantId:0},{tenantId:'other-tenant'},'invalid',[],{tenantId:{}}]){
  const incoming={...event,data:{...event.data,custom_data}};
  const result=check(incoming,binding,{signatureVerified:true});
  assert.equal(result.accepted,false,JSON.stringify(custom_data));
  assert.equal(result.grantEntitlement,false);
 }
 const valid=check({...event,data:{...event.data,custom_data:{tenantId}}},binding,{signatureVerified:true});
 assert.equal(valid.accepted,true);
 assert.equal(valid.grantEntitlement,false);
});

test('explicit null custom_data is rejected while absent metadata remains allowed',()=>{
 const nullMetadata=check({...event,data:{...event.data,custom_data:null}},binding,{signatureVerified:true});
 assert.equal(nullMetadata.accepted,false);
 assert.equal(nullMetadata.reason,'invalid_custom_data');
 assert.equal(nullMetadata.grantEntitlement,false);
 const absent=check(event,binding,{signatureVerified:true});
 assert.equal(absent.accepted,true);
 assert.equal(absent.grantEntitlement,false);
});

test('invalid provider calendar dates and offset components fail closed',()=>{
 for (const updated_at of ['2026-02-30T20:00:00Z','2026-11-31T20:00:00Z','2026-11-03T25:00:00Z',
  '2026-11-03T20:61:00Z','2026-11-03T20:00:61Z','2026-11-03T20:00:00+24:00',
  '2026-11-03T20:00:00+02:99','2026-11-03T20:00:00','2026-11-03T20:00:00.1234567890Z']) {
  const result=check({...event,data:{...event.data,updated_at}},binding,{signatureVerified:true});
  assert.equal(result.reason,'missing_ordering',updated_at);
  assert.equal(result.grantEntitlement,false);
 }
});
test('invalid persisted timestamps cannot coerce into replay watermarks',()=>{
 for (const lastProviderUpdatedAt of [0,1,[],{},'2026-02-30T20:00:00Z','2026-11-03T20:00:00+25:00']) {
  const result=check(event,{...binding,lastProviderUpdatedAt},{signatureVerified:true});
  assert.equal(result.reason,'invalid_watermark',JSON.stringify(lastProviderUpdatedAt));
 }
});
test('valid timezone-offset provider timestamps retain ordering without payment authority',()=>{
 const e={...event,data:{...event.data,updated_at:'2026-11-03T23:00:00+03:00'}};
 const prior={...binding,lastProviderUpdatedAt:'2026-11-03T19:59:59Z',lastProviderStatus:'past_due'};
 const result=check(e,prior,{signatureVerified:true});
 assert.equal(result.accepted,true);
 assert.equal(result.grantEntitlement,false);
 assert.equal(result.requiresVerifiedSettlementForAccess,true);
});

test('partial or null persisted Paddle watermarks cannot reset replay protection',()=>{
 for(const patch of [
  {lastProviderUpdatedAt:null},
  {lastProviderUpdatedAt:event.data.updated_at},
  {lastProviderStatus:'active'},
  {lastProviderEventId:event.event_id},
  {lastProviderUpdatedAt:event.data.updated_at,lastProviderStatus:'active'},
  {lastProviderUpdatedAt:event.data.updated_at,lastProviderEventId:event.event_id},
  {lastProviderUpdatedAt:event.data.updated_at,lastProviderStatus:'active',lastProviderEventId:null},
  {lastProviderUpdatedAt:event.data.updated_at,lastProviderStatus:'unknown',lastProviderEventId:event.event_id}
 ]) {
  const result=check(event,{...binding,...patch},{signatureVerified:true});
  assert.equal(result.reason,'invalid_watermark',JSON.stringify(patch));
  assert.equal(result.grantEntitlement,false);
 }
 const clean=check(event,binding,{signatureVerified:true});
 assert.equal(clean.accepted,true);
 assert.equal(clean.grantEntitlement,false);
});
