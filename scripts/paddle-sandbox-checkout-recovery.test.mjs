import test from 'node:test';
import assert from 'node:assert/strict';
import {decideSandboxCheckoutRecovery as decide} from './paddle-sandbox-checkout-recovery.mjs';
const uuid=x=>x.repeat(8)+'-'+x.repeat(4)+'-4'+x.repeat(3)+'-8'+x.repeat(3)+'-'+x.repeat(12);
const env=()=>({deploymentEnv:'staging',paddleEnv:'sandbox',paddleEnabled:'false',billingProvider:'paddle'});
const intent=()=>({source:'committed-tenant-sql',environment:'sandbox',
 id:uuid('1'),tenantId:uuid('2'),invoiceId:uuid('3'),
 paddlePriceId:'pri_01m6x7w5zy16nktzjwg2ezas2d',
 status:'reconciliation_required'});
const evidence=()=>({source:'trusted-server-reconciliation',environment:'sandbox',
 intentId:uuid('1'),tenantId:uuid('2'),invoiceId:uuid('3'),
 priceId:'pri_01m6x7w5zy16nktzjwg2ezas2d',foundExactlyOne:true,
 transactionId:'txn_'+'a'.repeat(26),collectionMode:'automatic',
 status:'draft',quantity:1});
test('ambiguous create response NEVER retries POST or unlocks checkout',()=>{
 for(const ev of [undefined,null,{error:'timeout'}, {status:500}, {source:'browser'}]){
  const r=decide(intent(),ev,env());
  assert.equal(r.canRetryCreate,false);
  assert.equal(r.checkoutAllowed,false);
  assert.equal(r.entitlementGranted,false);
  assert.equal(r.action,'manual_reconciliation_required');
 }
});
test('only matched independent reconciliation can propose persistence',()=>{
 const r=decide(intent(),evidence(),env());
 assert.equal(r.action,'persist_reconciled_transaction');
 assert.equal(r.canRetryCreate,false);
 assert.equal(r.checkoutAllowed,false);
});
test('foreign tenant, invoice, price, duplicate or malformed provider evidence refused',()=>{
 for(const patch of [
  {tenantId:uuid('9')}, {invoiceId:uuid('9')},
  {priceId:'pri_'+'b'.repeat(26)}, {foundExactlyOne:false},
  {transactionId:'txn_bad'}, {quantity:2},{status:'completed'},
  {collectionMode:'manual'}
 ]){
  const r=decide(intent(),{...evidence(),...patch},env());
  assert.equal(r.action,'manual_reconciliation_required');
  assert.equal(r.canRetryCreate,false);
 }
});
test('existing bound transaction is read-only, never created again',()=>{
 const r=decide({...intent(),status:'bound',transactionId:'txn_'+'b'.repeat(26)},null,env());
 assert.equal(r.action,'read_existing_binding');
 assert.equal(r.canRetryCreate,false);
});
test('production and payment-enabled contexts fail closed',()=>{
 for(const patch of [{deploymentEnv:'production'},{paddleEnv:'production'},
  {paddleEnabled:'true'},{billingProvider:'stripe'}]){
  const r=decide(intent(),evidence(),{...env(),...patch});
  assert.equal(r.ok,false);assert.equal(r.canRetryCreate,false);
 }
});
