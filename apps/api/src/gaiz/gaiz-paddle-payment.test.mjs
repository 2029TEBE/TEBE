import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {buildGaizPaddleCheckoutIntent,validateGaizPaddleCheckoutResponse} from './gaiz-paddle-checkout.mjs';
import {classifySignedGaizPaddleEvent,bindSignedGaizPaddlePayment} from './gaiz-paddle-notification.mjs';
const customerId='123e4567-e89b-42d3-a456-426614174000';
const orderId='b23e4567-e89b-42d3-a456-426614174000';
const priceId='pri_'+'a'.repeat(26);
const txnId='txn_'+'b'.repeat(26);
const principal={authenticated:true,identityProvider:'oidc',epmoTenantBound:false,customerId};
const order={id:orderId,customerId,toolId:'report-summary',productId:'catalog-a',
 amountMinor:1900,currency:'USD',revision:0,state:'created'};
const product={paddlePriceId:priceId,toolId:'report-summary',productId:'catalog-a',
 amountMinor:1900,currency:'USD',active:true};
const checkoutBase='https://orgaiz.example.test/checkout/';
const goodResponse={data:{id:txnId,status:'ready',collection_mode:'automatic',
 items:[{price:{id:priceId},quantity:1}],custom_data:{orgaiz_order_id:orderId},
 checkout:{url:checkoutBase+'?_ptxn='+txnId}}};
const fail=fn=>assert.throws(fn,/ORGAIZ Paddle/);
test('only server-priced OIDC customer orders may start checkout',()=>{
 const intent=buildGaizPaddleCheckoutIntent({principal,order,product,checkoutBase});
 assert.deepEqual(intent.items,[{price_id:priceId,quantity:1}]);
 assert.deepEqual(intent.custom_data,{orgaiz_order_id:orderId});
 for(const changed of [
 {principal:{...principal,customerId:'another'}},
 {order:{...order,amountMinor:1}},
 {product:{...product,paddlePriceId:'bad'}},
 {principal:{...principal,identityProvider:'epmo'}},
 {order:{...order,state:'paid'}}
 ])fail(()=>buildGaizPaddleCheckoutIntent({principal,order,product,checkoutBase,...changed}));
 const result=validateGaizPaddleCheckoutResponse({response:goodResponse,order,product,checkoutBase});
 assert.equal(result.paymentVerified,false);
 assert.equal(result.providerTransactionId,txnId);
});
test('checkout response cannot redirect to arbitrary origin or mismatched transaction',()=>{
 for(const response of [
  {data:{...goodResponse.data,checkout:{url:'https://evil.example.test/checkout/?_ptxn='+txnId}}},
  {data:{...goodResponse.data,checkout:{url:checkoutBase+'?_ptxn='+txnId+'&next=evil'}}},
  {data:{...goodResponse.data,items:[{price:{id:'pri_'+'x'.repeat(26)},quantity:1}]}},
  {data:{...goodResponse.data,custom_data:{orgaiz_order_id:'another'}}}
 ])fail(()=>validateGaizPaddleCheckoutResponse({response,order,product,checkoutBase}));
});
const secret='synthetic-only-webhook-secret-1234',timestamp='1794830000';
function eventInput(event){
 const rawBody=Buffer.from(JSON.stringify(event));
 const sig=createHmac('sha256',secret).update(timestamp).update(':').update(rawBody).digest('hex');
 return {rawBody,signatureHeader:'ts='+timestamp+';h1='+sig,secret,nowMs:Number(timestamp)*1000};
}
const completed={event_id:'evt_synthetic123',event_type:'transaction.completed',
 occurred_at:'2026-11-16T12:00:00Z',
 data:{id:txnId,status:'completed',currency_code:'USD',
 details:{totals:{grand_total:'1900'}},
 custom_data:{orgaiz_order_id:'attacker-controlled'}}};
const binding={provider:'paddle',orderId,customerId,providerTransactionId:txnId,
 amountMinor:1900,currency:'USD',state:'awaiting_payment',environment:'sandbox'};
test('verified Paddle notification resolves canonical binding instead of webhook custom data',()=>{
 const ev=classifySignedGaizPaddleEvent(eventInput(completed));
 assert.equal(ev.action,'candidate-paid');
 assert.equal(ev.providerTransactionId,txnId);
 const proof=bindSignedGaizPaddlePayment({event:ev,binding,environment:'sandbox'});
 assert.equal(proof.orderId,orderId);
 assert.equal(proof.customerId,customerId);
 assert.equal(proof.verifiedByServer,true);
});
test('raw body modification, stale signature, cross-environment and underpayment are rejected',()=>{
 const payload=eventInput(completed);
 fail(()=>classifySignedGaizPaddleEvent({...payload,rawBody:Buffer.from('{}')}));
 fail(()=>classifySignedGaizPaddleEvent({...payload,nowMs:Number(timestamp)*1000+120000}));
 const ev=classifySignedGaizPaddleEvent(payload);
 for(const changed of [
 {binding:{...binding,amountMinor:1800}},
 {binding:{...binding,providerTransactionId:'txn_'+'a'.repeat(26)}},
 {environment:'live'},
 {binding:{...binding,state:'paid'}}
 ])fail(()=>bindSignedGaizPaddlePayment({event:ev,binding,environment:'sandbox',...changed}));
});
test('refunds and failures never issue a paid proof',()=>{
 for(const eventType of ['transaction.payment_failed','transaction.canceled','adjustment.updated']){
  const d={...completed,event_type:eventType};
  const out=classifySignedGaizPaddleEvent(eventInput(d));
  assert.equal(out.action,'reconcile');
  fail(()=>bindSignedGaizPaddlePayment({event:out,binding,environment:'sandbox'}));
 }
 const unknown=classifySignedGaizPaddleEvent(eventInput({...completed,event_type:'customer.created'}));
 assert.equal(unknown.action,'ignore');
});
