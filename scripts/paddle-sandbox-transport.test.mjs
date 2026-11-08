import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePaddleSandboxCheckout} from './paddle-sandbox-checkout-policy.mjs';
import {createSandboxPaddleTransaction} from './paddle-sandbox-transport.mjs';
const uuid=x=>x.repeat(8)+'-'+x.repeat(4)+'-4'+x.repeat(3)+'-8'+x.repeat(3)+'-'+x.repeat(12);
const id=uuid('1'),price='pri_'+'a'.repeat(26),txn='txn_'+'b'.repeat(26);
const now=1800000000000;
const prepared=()=>preparePaddleSandboxCheckout({
 source:'locked-tenant-record',provider:'paddle',environment:'sandbox',
 intentId:id,tenantId:uuid('2'),invoiceId:uuid('5'),attemptId:uuid('6'),
 subscriptionId:uuid('3'),planId:uuid('4'),expiresAt:now+300000
},{source:'server-approved-catalogue',environment:'sandbox',planId:uuid('4'),
 paddlePriceId:price,amountMinor:10000,currency:'USD',isActive:true},{now});
const key='pdl_sdbx_apikey_'+'a'.repeat(36);
const fake=(capture,override={})=>async(url,req)=>{
 capture.push({url,req});
 return {ok:true,status:201,headers:{get:()=> 'application/json'},
 json:async()=>({data:{id:txn,status:'draft',collection_mode:'automatic',
  items:[{price:{id:price},quantity:1}],custom_data:{epmo_intent_id:id,
   epmo_attempt_id:uuid('6'),epmo_invoice_id:uuid('5'),epmo_tenant_id:uuid('2')},...override}})};
};
test('network is refused by default even with valid sandbox credentials',async()=>{
 let contacted=false;
 const result=await createSandboxPaddleTransaction(prepared(),{apiKey:key,fetchImpl:async()=>{contacted=true;}});
 assert.equal(result.ok,false); assert.equal(contacted,false);
});
test('live key cannot enter sandbox transport',async()=>{
 let contacted=false;
 const result=await createSandboxPaddleTransaction(prepared(),{
  apiKey:'pdl_live_apikey_'+'x'.repeat(36),sandboxNetworkApproved:true,
  fetchImpl:async()=>{contacted=true;}
 });
 assert.equal(result.ok,false); assert.equal(contacted,false);
});
test('approved injected sandbox transport uses exact fixed HTTPS route and validated response',async()=>{
 const calls=[];
 const result=await createSandboxPaddleTransaction(prepared(),{
  apiKey:key,sandboxNetworkApproved:true,fetchImpl:fake(calls)
 });
 assert.equal(result.ok,true);assert.equal(result.sandboxOnly,true);
 assert.equal(result.entitlementGranted,false);assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://sandbox-api.paddle.com/transactions');
 assert.equal(calls[0].req.headers['Paddle-Version'],'1');
 assert.equal(calls[0].req.redirect,'error');
 assert.deepEqual(JSON.parse(calls[0].req.body).items,[{price_id:price,quantity:1}]);
 assert.deepEqual(JSON.parse(calls[0].req.body).custom_data,{
   epmo_intent_id:id,epmo_attempt_id:uuid('6'),epmo_invoice_id:uuid('5'),
   epmo_tenant_id:uuid('2')});
});
test('non-201 and malformed provider response do not confirm payment',async()=>{
 for(const f of [
  async()=>({status:400,ok:false}),fake([],{id:'txn_other'}),
  fake([],{custom_data:{epmo_intent_id:id,epmo_attempt_id:uuid('9'),
    epmo_invoice_id:uuid('5'),epmo_tenant_id:uuid('2')}}),
  async()=>{throw new Error('secret_internal_error')},
 ]) {
  const result=await createSandboxPaddleTransaction(prepared(),{
   apiKey:key,sandboxNetworkApproved:true,fetchImpl:f
  });
  assert.equal(result.ok,false);
  assert.equal(JSON.stringify(result).includes('secret_internal_error'),false);
 }
});
