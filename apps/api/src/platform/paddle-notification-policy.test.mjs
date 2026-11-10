import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { evaluateSignedPaddleSubscription } from './paddle-notification-policy.mjs';

const secret = 'pdl_ntfset_test_verification_secret_12345';
const nowMs = Date.parse('2026-11-10T16:00:00.000Z');
const ts = String(nowMs / 1000);
const id = {
  tenant: '2bb4c19e-ac7d-47a3-8fa1-f917640e127a',
  sub: 'sub_' + 'a'.repeat(26),
  customer: 'ctm_' + 'b'.repeat(26),
  price: 'pri_' + 'c'.repeat(26),
  product: 'pro_' + 'd'.repeat(26),
  event: 'evt_' + 'e'.repeat(26),
};
const base = { event_id: id.event, event_type: 'subscription.updated',
  occurred_at: '2026-11-10T16:00:00.000Z',
  data: { id:id.sub, customer_id:id.customer, status:'active',
    items:[{price:{id:id.price,product_id:id.product}}], 
    custom_data:{tenant_id:'a-malicious-client-supplied-tenant'} } };
const binding = { tenantId:id.tenant, providerSubscriptionId:id.sub,
  providerCustomerId:id.customer, lastEventId:null, lastEventAt:null };
function deliver(payload, bound=binding, secretValue=secret) {
  const raw = Buffer.from(JSON.stringify(payload));
  const sig = 'ts='+ts+';h1='+createHmac('sha256',secret).update(ts).update(':').update(raw).digest('hex');
  return evaluateSignedPaddleSubscription(raw,sig,secretValue,bound,nowMs);
}
test('a signed event can only propose a change against a durable binding',()=>{
  const result=deliver(base);
  assert.equal(result.action,'apply');
  assert.equal(result.tenantId,id.tenant);
  assert.equal(result.allowAccess,true);
  assert.deepEqual(result.priceIds,[id.price]);
  assert.equal('tenantId' in base.data,false);
});
test('a notification cannot create a tenant from signed custom_data',()=>{
  assert.throws(()=>deliver(base,null),/Missing server-owned/);
  assert.throws(()=>deliver(base,{...binding,tenantId:'a-malicious-client-supplied-tenant'}),/does not match/);
});
test('a signed notification for the wrong provider subscription or customer fails',()=>{
  assert.throws(()=>deliver(base,{...binding,providerSubscriptionId:'sub_'+'x'.repeat(26)}),/does not match/);
  assert.throws(()=>deliver(base,{...binding,providerCustomerId:'ctm_'+'x'.repeat(26)}),/does not match/);
});
test('duplicate and stale events do not propose access changes',()=>{
  const duplicate=deliver(base,{...binding,lastEventId:id.event,lastEventAt:base.occurred_at});
  assert.equal(duplicate.action,'duplicate');
  assert.equal(duplicate.allowAccess,null);
  const stale=deliver(base,{...binding,lastEventAt:'2026-11-10T16:00:01.000Z'});
  assert.equal(stale.action,'stale');
  assert.equal(stale.allowAccess,null);
});
test('signed cancellation proposes revocation and unknown events are ignored',()=>{
  assert.equal(deliver({...base,data:{...base.data,status:'canceled'}}).allowAccess,false);
  assert.deepEqual(deliver({...base,event_type:'transaction.completed'},null),
    {action:'ignore',eventId:id.event});
});
test('invalid secret or tampered body fails before subscription processing',()=>{
  assert.throws(()=>deliver(base,binding,secret+'invalid'),/Invalid Paddle webhook signature/);
  const raw=Buffer.from(JSON.stringify(base));
  const bad='ts='+ts+';h1='+'0'.repeat(64);
  assert.throws(()=>evaluateSignedPaddleSubscription(raw,bad,secret,binding,nowMs),
    /Invalid Paddle webhook signature/);
});
