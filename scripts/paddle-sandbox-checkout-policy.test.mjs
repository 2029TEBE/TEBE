import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePaddleSandboxCheckout as prepare,validatePaddleSandboxTransaction as verify} from './paddle-sandbox-checkout-policy.mjs';
const id=x=>x.repeat(8)+'-'+x.repeat(4)+'-4'+x.repeat(3)+'-8'+x.repeat(3)+'-'+x.repeat(12);
const price='pri_'+'a'.repeat(26), txn='txn_'+'b'.repeat(26);
const now=1800000000000;
const binding=()=>({source:'locked-tenant-record',provider:'paddle',environment:'sandbox',
 intentId:id('1'),tenantId:id('2'),invoiceId:id('5'),attemptId:id('6'),
 subscriptionId:id('3'),planId:id('4'),expiresAt:now+600000});
const catalogue=()=>({source:'server-approved-catalogue',environment:'sandbox',
 planId:id('4'),paddlePriceId:price,amountMinor:25000,currency:'SAR',isActive:true});
const good=()=>prepare(binding(),catalogue(),{now});
const response=()=>({id:txn,status:'draft',collection_mode:'automatic',
 items:[{price:{id:price},quantity:1}],custom_data:{epmo_intent_id:id('1'),epmo_attempt_id:id('6'),
 epmo_invoice_id:id('5'),epmo_tenant_id:id('2')}});
test('sandbox checkout request is bound to authenticated server records, not a browser price',()=>{
 const x=good(); assert.equal(x.ok,true);
 assert.equal(x.apiOrigin,'https://sandbox-api.paddle.com');
 assert.deepEqual(x.request.items,[{price_id:price,quantity:1}]);
 assert.deepEqual(x.request.custom_data,{
   epmo_intent_id:id('1'),epmo_attempt_id:id('6'),
   epmo_invoice_id:id('5'),epmo_tenant_id:id('2')
 });
 assert.equal(x.collectionEnabled,false);assert.equal(x.entitlementGranted,false);
});
test('reject missing, foreign, stale or overly long checkout intents',()=>{
 for(const b of [null,{...binding(),tenantId:'foreign'},
  {...binding(),invoiceId:undefined},{...binding(),attemptId:undefined}, {...binding(),source:'browser'},
  {...binding(),environment:'production'},{...binding(),planId:id('7')},
  {...binding(),expiresAt:now-1},{...binding(),expiresAt:now+900001}])
  assert.equal(prepare(b,catalogue(),{now}).ok,false);
});
test('reject unapproved or production prices and unsafe amounts',()=>{
 for(const c of [null,{...catalogue(),isActive:false},{...catalogue(),environment:'production'},
  {...catalogue(),paddlePriceId:'pri_bad'}, {...catalogue(),amountMinor:-1},
  {...catalogue(),amountMinor:1.3},{...catalogue(),currency:'usd'},
  {...catalogue(),source:'browser'}])
  assert.equal(prepare(binding(),c,{now}).ok,false);
});
test('provider response can only become a tenant-bound persistence candidate',()=>{
 const value=verify(good(),response());
 assert.equal(value.ok,true);assert.equal(value.transactionId,txn);
 assert.equal(value.requiresAtomicTenantPersistence,true);
 assert.equal(value.collectionEnabled,false);assert.equal(value.entitlementGranted,false);
});
test('fake checkout responses, different IDs and mismatched prices fail closed',()=>{
 for(const patch of [{id:'txn_wrong'},{status:'completed'}, {collection_mode:'manual'},
  {items:[{price:{id:'pri_'+'c'.repeat(26)},quantity:1}]},
  {items:[{price:{id:price},quantity:2}]},
  {custom_data:{epmo_intent_id:id('9')}},
  {custom_data:{...response().custom_data,epmo_attempt_id:id('9')}},
  {custom_data:{...response().custom_data,epmo_invoice_id:id('9')}},
  {custom_data:{...response().custom_data,epmo_tenant_id:id('9')}}, {checkout:{url:'https://evil.example/'}}]){
  const obj={...response(),...patch};
  if(patch.checkout) obj.custom_data={};
  assert.equal(verify(good(),obj).ok,false);
 }
});
