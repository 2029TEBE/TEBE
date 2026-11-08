import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareVerifiedTeamWorkspaceCheckout} from './paddle-team-workspace-checkout-preflight.mjs';
import {verifyPersistedSandboxCheckout as verify} from './paddle-checkout-persistence-proof.mjs';
const uuid=x=>x.repeat(8)+'-'+x.repeat(4)+'-4'+x.repeat(3)+'-8'+x.repeat(3)+'-'+x.repeat(12);
const now=1800000000000;
const b=()=>({source:'locked-tenant-record',provider:'paddle',environment:'sandbox',
 planKey:'team_workspace_monthly',intentId:uuid('1'),tenantId:uuid('2'),
 invoiceId:uuid('5'),attemptId:uuid('6'),
 subscriptionId:uuid('3'),planId:uuid('4'),expiresAt:now+600000,
 planAmountMinor:4900,planCurrency:'USD',planInterval:'month',planFrequency:1});
const prepared=()=>prepareVerifiedTeamWorkspaceCheckout(b(),
 {deploymentEnv:'staging',paddleEnv:'sandbox',paddleEnabled:'false',billingProvider:'paddle'},{now});
const txn='txn_'+'a'.repeat(26);
const candidate=()=>({ok:true,transactionId:txn,intentId:b().intentId,
 requiresAtomicTenantPersistence:true,collectionEnabled:false,entitlementGranted:false});
const row=()=>({source:'committed-tenant-sql',environment:'sandbox',
 tenantId:b().tenantId,intentId:b().intentId,invoiceId:uuid('5'),
 attemptId:uuid('6'),
 subscriptionId:b().subscriptionId,planId:b().planId,
 paddleTransactionId:txn,paddlePriceId:'pri_01m6x7w5zy16nktzjwg2ezas2d',
 invoiceStatus:'open',invoiceAmountMinor:4900,invoiceCurrency:'USD',
 expiresAt:now+600000});
const run=(p=prepared(),c=candidate(),r=row())=>verify(p,c,r,{now});
test('requires exact committed tenant invoice and Paddle transaction binding',()=>{
 const v=run(); assert.equal(v.ok,true);assert.equal(v.persisted,true);
 assert.equal(v.checkoutAllowed,false);assert.equal(v.entitlementGranted,false);
});
test('rejects absent, spoofed, cross-tenant, foreign transaction and incorrect invoice rows',()=>{
 for(const patch of [null,{source:'browser'},{tenantId:uuid('9')},
 {intentId:uuid('9')},{invoiceId:'bad'},{invoiceId:uuid('9')},
 {attemptId:uuid('9')},{subscriptionId:uuid('9')},
 {planId:uuid('9')},{paddleTransactionId:'txn_'+'b'.repeat(26)},
 {paddlePriceId:'pri_'+'b'.repeat(26)},{invoiceAmountMinor:1},
 {invoiceCurrency:'SAR'},{invoiceStatus:'paid'},{expiresAt:now-1}]){
  const result=run(prepared(),candidate(),patch===null?null:{...row(),...patch});
  assert.equal(result.ok,false);assert.equal(result.checkoutAllowed,false);
 }
});
test('rejects synthetic candidates without prior persistence requirement',()=>{
 for(const patch of [{requiresAtomicTenantPersistence:false},{ok:false},
 {collectionEnabled:true},{entitlementGranted:true},{transactionId:'invalid'},
 {intentId:uuid('9')}]) assert.equal(run(prepared(),{...candidate(),...patch}).ok,false);
});
