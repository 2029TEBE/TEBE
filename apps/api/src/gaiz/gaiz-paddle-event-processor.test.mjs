import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createGaizPaddleEventProcessor} from './gaiz-paddle-event-processor.mjs';
const secret='synthetic-webhook-signing-secret-123456';
const timestamp='1794830000',nowMs=Number(timestamp)*1000;
const providerTransactionId='txn_'+'b'.repeat(26);
const order={id:'order-a',customerId:'customer-a',toolId:'executive-report',
 currency:'USD',amountMinor:1900,providerTransactionId,state:'awaiting_payment',revision:1};
const binding={provider:'paddle',orderId:order.id,customerId:order.customerId,
 amountMinor:order.amountMinor,currency:'USD',state:'awaiting_payment',
 providerTransactionId,environment:'sandbox'};
const paid={event_id:'evt_example123',event_type:'transaction.completed',
 occurred_at:'2026-11-16T12:00:00Z',
 data:{id:providerTransactionId,status:'completed',currency_code:'USD',
 details:{totals:{grand_total:'1900'}}}};
const signed=(e)=>{
 const rawBody=Buffer.from(JSON.stringify(e));
 return {rawBody,signatureHeader:'ts='+timestamp+';h1='+
  createHmac('sha256',secret).update(timestamp).update(':').update(rawBody).digest('hex'),nowMs};
};
function fixture(){
 const used=new Set(),events=[],audit=[];
 const store={async consumeSignedEventAtomically({eventId,perform,environment,...rest}){
  if(used.has(eventId))return {action:'duplicate'};
  const result=await perform({binding,order,recordAudit:async e=>audit.push(e)});
  used.add(eventId);events.push({eventId,environment,...rest});
  return result;
 }};
 return {used,events,audit,processor:createGaizPaddleEventProcessor({
  enabled:true,webhookSecret:secret,environment:'sandbox',store,
  audit:{recordInTransaction:async()=>{}}
 })};
}
test('disabled processor refuses live startup without durable event store',()=>{
 assert.throws(()=>createGaizPaddleEventProcessor());
 assert.throws(()=>createGaizPaddleEventProcessor({enabled:true,webhookSecret:secret,environment:'sandbox'}));
});
test('signed Paddle payment updates only a server-bound order in atomic adapter',async()=>{
 const f=fixture();
 const a=await f.processor.receive(signed(paid));
 assert.equal(a.action,'apply');assert.equal(a.order.state,'paid');
 assert.equal(a.order.revision,2);assert.equal(f.audit[0].kind,'orgaiz.payment.completed');
 assert.equal(f.events.length,1);assert.equal(f.events[0].environment,'sandbox');
 const replay=await f.processor.receive(signed(paid));
 assert.deepEqual(replay,{action:'duplicate'});assert.equal(f.audit.length,1);
});
test('failed signatures never reach storage, refunds require reconciliation',async()=>{
 const f=fixture();
 await assert.rejects(f.processor.receive({
  ...signed(paid),signatureHeader:'ts='+timestamp+';h1='+'0'.repeat(64)
 }));
 assert.equal(f.events.length,0);
 const refund={...paid,event_id:'evt_refund123',event_type:'adjustment.updated',data:{id:'adj_123'}};
 const result=await f.processor.receive(signed(refund));
 assert.equal(result.action,'reconcile');
 assert.equal(f.audit[0].kind,'orgaiz.payment.reconciliation_required');
});
test('unrelated events are ignored and cannot grant access',async()=>{
 const f=fixture();
 const result=await f.processor.receive(signed({...paid,event_type:'customer.updated'}));
 assert.deepEqual(result,{accepted:true,action:'ignored'});
 assert.equal(f.events.length,0);
});
