import test from 'node:test';
import assert from 'node:assert/strict';
import { persistVerifiedTestEvent } from './commercial-webhook-transaction.mjs';

const binding={mode:'test',deployment:'shared_saas',tenantId:'tenant-a',accountId:'acct_test',customerId:'cus_a',subscriptionId:'sub_a',currency:'sar',expectedAmountMinor:1000};
const event={id:'evt_1',type:'invoice.paid',livemode:false,created:100,account:'acct_test',data:{object:{customer:'cus_a',subscription:'sub_a',currency:'sar',amount_due:1000,amount_paid:1000,paid:true,status:'paid'}}};
function memoryAdapter() {
  const events=new Set(), log=[]; let state=null, enabled=false;
  return {log, get enabled(){return enabled}, withSerializableTenantTransaction:async(tenant,fn)=>{
    assert.equal(tenant,'tenant-a');
    return fn({
      lockSubscription:async()=>log.push('lock'),
      claimEvent:async(account,id)=>{log.push('claim');if(events.has(id))return false;events.add(id);return true},
      getSubscriptionState:async()=>state,
      setEntitlement:async(_a,_s,v)=>{enabled=v.enabled;log.push('entitlement')},
      setSubscriptionState:async(_a,_s,v)=>{state=v;log.push('state')},
      finishEvent:async()=>log.push('finish'),
    });
  }};
}
test('settled signed TEST invoice persists grant and event in one transaction',async()=>{
  const db=memoryAdapter();
  const result=await persistVerifiedTestEvent({event,binding,verifiedSignature:true,database:db});
  assert.equal(result.action,'grant');assert.equal(db.enabled,true);
  assert.deepEqual(db.log,['lock','claim','entitlement','state','finish']);
});
test('duplicate never mutates entitlement',async()=>{
  const db=memoryAdapter(),args={event,binding,verifiedSignature:true,database:db};
  await persistVerifiedTestEvent(args);db.log.length=0;
  assert.equal((await persistVerifiedTestEvent(args)).action,'duplicate');
  assert.deepEqual(db.log,['lock','claim']);
});
test('invalid signature, live mode, missing adapter and malformed time fail closed',async()=>{
  const db=memoryAdapter(),base={event,binding,verifiedSignature:true,database:db};
  for(const changes of [{verifiedSignature:false},{event:{...event,livemode:true}},{event:{...event,created:NaN}},{database:null}])
    await assert.rejects(persistVerifiedTestEvent({...base,...changes}));
  assert.deepEqual(db.log,[]);
});
test('failed payment revokes entitlement and records state',async()=>{
  const db=memoryAdapter(),args={event,binding,verifiedSignature:true,database:db};
  await persistVerifiedTestEvent(args);
  const failed={...event,id:'evt_2',created:101,type:'invoice.payment_failed'};
  const result=await persistVerifiedTestEvent({...args,event:failed});
  assert.equal(result.action,'revoke');assert.equal(db.enabled,false);
});
test('stale event is marked processed without reverting entitlement',async()=>{
  const db=memoryAdapter(),args={event,binding,verifiedSignature:true,database:db};
  await persistVerifiedTestEvent(args);
  const old={...event,id:'evt_old',created:99,type:'invoice.payment_failed'};
  assert.equal((await persistVerifiedTestEvent({...args,event:old})).action,'stale');
  assert.equal(db.enabled,true);
});
