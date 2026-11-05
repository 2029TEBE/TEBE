import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPaddleInvoiceActivation as review} from './paddle-entitlement-readiness.mjs';
const id=x=>x.repeat(8)+'-'+x.repeat(4)+'-4'+x.repeat(3)+'-8'+x.repeat(3)+'-'+x.repeat(12);
const tenant=id('1'),subscription=id('2'),invoice=id('3'),settlement=id('4'),receipt=id('5'),intent=id('6');
const txn='txn_'+'a'.repeat(26);
function fixture(){
 return {source:'locked-tenant-postgres',latestSubscriptionId:subscription,
  merchantReconciled:true,adjustments:[],
  invoice:{id:invoice,tenantId:tenant,subscriptionId:subscription,status:'open',
   amountMinor:11500,currency:'SAR',
   periodStartsAt:'2026-12-05T00:00:00Z',periodEndsAt:'2027-01-05T00:00:00Z'},
  subscription:{id:subscription,tenantId:tenant,status:'active',
   cancelAtPeriodEnd:false,periodEndsAt:'2026-12-05T00:00:00Z'},
  settlement:{id:settlement,tenantId:tenant,subscriptionId:subscription,invoiceId:invoice,
   checkoutIntentId:intent,receiptId:receipt,paddleTransactionId:txn,amountMinor:11500,currency:'SAR'},
  receipt:{id:receipt,tenantId:tenant,checkoutIntentId:intent,paddleTransactionId:txn}};
}
test('an internally reconciled settlement only produces a release candidate, never a paid grant',()=>{
 const result=review(fixture());
 assert.equal(result.eligible,true);
 assert.equal(result.grantEntitlement,false);
 assert.equal(result.markInvoicePaid,false);
});
test('preflight fails without independent Paddle merchant reconciliation',()=>{
 assert.equal(review({...fixture(),merchantReconciled:false}).eligible,false);
});
test('foreign tenant, invoice, subscription and checkout references fail closed',()=>{
 for(const changed of [
   {settlement:{...fixture().settlement,tenantId:id('7')}},
   {receipt:{...fixture().receipt,checkoutIntentId:id('7')}},
   {invoice:{...fixture().invoice,subscriptionId:id('7')}},
   {latestSubscriptionId:id('7')},
 ]) assert.equal(review({...fixture(),...changed}).eligible,false);
});
test('missing or mismatched currency, amount and date periods fail closed',()=>{
 for(const changed of [
  {invoice:{...fixture().invoice,currency:'USD'}},
  {settlement:{...fixture().settlement,amountMinor:11499}},
  {invoice:{...fixture().invoice,periodStartsAt:'2026-11-05T00:00:00Z'}},
  {invoice:{...fixture().invoice,status:'paid'}},
 ]) assert.equal(review({...fixture(),...changed}).eligible,false);
});
test('refunds, pending refunds, chargebacks and warnings block new entitlement grants',()=>{
 for(const item of [
  {action:'refund',status:'approved'},
  {action:'refund',status:'pending_approval'},
  {action:'chargeback',status:'approved'},
  {action:'chargeback_warning',status:'pending_approval'},
 ]) {
  const f=fixture();f.adjustments=[{...item,paddleTransactionId:txn}];
  assert.equal(review(f).eligible,false,item.action);
 }
});
test('missing adjustment audit and canceled subscription cannot qualify',()=>{
 assert.equal(review({...fixture(),adjustments:null}).eligible,false);
 const f=fixture();f.subscription.status='canceled';
 assert.equal(review(f).eligible,false);
});
