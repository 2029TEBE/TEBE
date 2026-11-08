import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSandboxRecoveryCandidates as inspect} from './paddle-sandbox-reconciliation-candidates.mjs';
const uuid=x=>x.repeat(8)+'-'+x.repeat(4)+'-4'+x.repeat(3)+'-8'+x.repeat(3)+'-'+x.repeat(12);
const intent=()=>({source:'committed-tenant-sql',environment:'sandbox',status:'reconciliation_required',
 id:uuid('1'),attemptId:uuid('4'),tenantId:uuid('2'),invoiceId:uuid('3'),
 paddlePriceId:'pri_01m6x7w5zy16nktzjwg2ezas2d',amountMinor:4900,currency:'USD'});
const env=()=>({deploymentEnv:'staging',paddleEnv:'sandbox',paddleEnabled:'false',billingProvider:'paddle'});
const candidate=(id='txn_'+'a'.repeat(26))=>({id,status:'draft',collection_mode:'automatic',
 currency_code:'USD',items:[{price:{id:'pri_01m6x7w5zy16nktzjwg2ezas2d'},quantity:1}],
 custom_data:{epmo_intent_id:uuid('1'),epmo_attempt_id:uuid('4'),epmo_invoice_id:uuid('3'),
 epmo_tenant_id:uuid('2')}});
const listing=(transactions=[candidate()])=>({source:'server-provider-list-read',environment:'sandbox',
 allPagesExhausted:true,filtersVerified:true,transactions});
test('one correctly bound candidate is merely reviewable, never payment-authorized',()=>{
 const r=inspect(intent(),listing(),env());
 assert.equal(r.ok,true);
 assert.equal(r.action,'review_candidate_without_persistence');
 assert.equal(r.providerVerified,false);
 assert.equal(r.canRetryCreate,false);
 assert.equal(r.checkoutAllowed,false);
 assert.equal(r.entitlementGranted,false);
});
test('partial and unverified provider search always require manual review',()=>{
 for(const patch of [{allPagesExhausted:false},{filtersVerified:false},
  {source:'browser'}, {transactions:undefined},{environment:'production'}]){
  const r=inspect(intent(),{...listing(),...patch},env());
  assert.equal(r.ok,false);assert.equal(r.action,'manual_reconciliation_required');
  assert.equal(r.canRetryCreate,false);
 }
});
test('zero, multiple and duplicate provider records never trigger create retry',()=>{
 const a=candidate(),b=candidate('txn_'+'b'.repeat(26));
 for(const transactions of [[],[a,b],[a,a]]){
  const r=inspect(intent(),listing(transactions),env());
  assert.equal(r.ok,false);assert.equal(r.canRetryCreate,false);
 }
});
test('foreign identity, price, quantity, currency, mode or status are rejected',()=>{
 const base=candidate();
 for(const patch of [
  {custom_data:{...base.custom_data,epmo_tenant_id:uuid('9')}},
  {custom_data:{...base.custom_data,epmo_invoice_id:uuid('9')}},
  {custom_data:{...base.custom_data,epmo_attempt_id:uuid('9')}},
  {custom_data:{...base.custom_data,epmo_intent_id:uuid('9')}},
  {items:[{price:{id:'pri_'+'b'.repeat(26)},quantity:1}]},
  {items:[{price:{id:'pri_01m6x7w5zy16nktzjwg2ezas2d'},quantity:2}]},
  {currency_code:'SAR'},{collection_mode:'manual'},{status:'completed'},
 ]){
  const r=inspect(intent(),listing([{...base,...patch}]),env());
  assert.equal(r.ok,false);assert.equal(r.canRetryCreate,false);
 }
});
test('production and enabled checkout are blocked even with a matching candidate',()=>{
 for(const patch of [{deploymentEnv:'production'},{paddleEnv:'live'},
   {paddleEnabled:'true'},{billingProvider:'stripe'}]){
  const r=inspect(intent(),listing(),{...env(),...patch});
  assert.equal(r.ok,false);assert.equal(r.canRetryCreate,false);
 }
});
