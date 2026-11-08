import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePaddleSandboxCheckout,validatePaddleSandboxTransaction}
 from './paddle-sandbox-checkout-policy.mjs';
import {inspectSandboxRecoveryCandidates}
 from './paddle-sandbox-reconciliation-candidates.mjs';
const uuid=x=>x.repeat(8)+'-'+x.repeat(4)+'-4'+x.repeat(3)+'-8'+x.repeat(3)+'-'+x.repeat(12);
const PRICE='pri_01m6x7w5zy16nktzjwg2ezas2d';
const TXN='txn_'+'a'.repeat(26);
const now=1800000000000;
const binding=()=>({source:'locked-tenant-record',provider:'paddle',environment:'sandbox',
 intentId:uuid('1'),tenantId:uuid('2'),invoiceId:uuid('3'),attemptId:uuid('4'),
 subscriptionId:uuid('5'),planId:uuid('6'),expiresAt:now+300000});
const catalog=()=>({source:'server-approved-catalogue',environment:'sandbox',
 planId:uuid('6'),paddlePriceId:PRICE,amountMinor:4900,currency:'USD',isActive:true});
const env={deploymentEnv:'staging',paddleEnv:'sandbox',paddleEnabled:'false',billingProvider:'paddle'};
const transaction=prepared=>({id:TXN,collection_mode:'automatic',status:'draft',
 currency_code:'USD',items:[{price:{id:PRICE},quantity:1}],
 custom_data:prepared.request.custom_data});
const list=transactions=>({environment:'sandbox',source:'server-provider-list-read',
 allPagesExhausted:true,filtersVerified:true,transactions});
const commit=()=>({source:'committed-tenant-sql',environment:'sandbox',
 status:'reconciliation_required',id:uuid('1'),tenantId:uuid('2'),
 invoiceId:uuid('3'),attemptId:uuid('4'),paddlePriceId:PRICE,
 amountMinor:4900,currency:'USD'});
test('checkout request metadata can be matched by offline reconciliation candidate audit',()=>{
 const prepared=preparePaddleSandboxCheckout(binding(),catalog(),{now});
 assert.equal(prepared.ok,true);
 const t=transaction(prepared);
 const validated=validatePaddleSandboxTransaction(prepared,t);
 assert.equal(validated.ok,true);
 const recovered=inspectSandboxRecoveryCandidates(commit(),list([t]),env);
 assert.equal(recovered.ok,true);
 assert.equal(recovered.candidateTransactionId,TXN);
 assert.equal(recovered.action,'review_candidate_without_persistence');
 assert.equal(recovered.providerVerified,false);
 assert.equal(recovered.canRetryCreate,false);
 assert.equal(recovered.checkoutAllowed,false);
 assert.equal(recovered.entitlementGranted,false);
});
test('omitting or altering even one server-owned recovery identifier fails closed',()=>{
 const prepared=preparePaddleSandboxCheckout(binding(),catalog(),{now});
 for(const field of ['epmo_intent_id','epmo_attempt_id','epmo_invoice_id','epmo_tenant_id']){
  const t=transaction(prepared);
  delete t.custom_data[field];
  assert.equal(validatePaddleSandboxTransaction(prepared,t).ok,false);
  assert.equal(inspectSandboxRecoveryCandidates(commit(),list([t]),env).ok,false);
  const wrong=transaction(prepared);
  wrong.custom_data[field]=uuid('9');
  assert.equal(validatePaddleSandboxTransaction(prepared,wrong).ok,false);
  assert.equal(inspectSandboxRecoveryCandidates(commit(),list([wrong]),env).ok,false);
 }
});
