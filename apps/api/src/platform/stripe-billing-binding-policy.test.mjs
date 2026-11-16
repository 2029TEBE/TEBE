import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyServerOwnedStripeBillingBinding} from './stripe-billing-binding-policy.mjs';
const tenantId='11111111-1111-4111-8111-111111111111';
const planId='22222222-2222-4222-8222-222222222222';
const base={tenantId,planId,accountId:'acct_Test1',livemode:false,
 customerId:'cus_Test1',subscriptionId:'sub_Test1',checkoutSessionId:'cs_test_Test1',
 stripePriceId:'price_Test1',catalogueRevision:1};
const approvedPrice={status:'approved',accountId:base.accountId,
 livemode:false,planId,stripePriceId:base.stripePriceId,catalogueRevision:1,
 approvedBy:'adminA',approvedAt:'2026-11-16T00:00:00Z',requestedBy:'adminB'};
const binding={tenantId,planId,accountId:base.accountId,livemode:false,
 customerId:base.customerId,subscriptionId:base.subscriptionId,
 checkoutSessionId:base.checkoutSessionId,stripePriceId:base.stripePriceId,
 catalogueRevision:1,status:'pending_verification'};
const valid={...base,approvedPrice,binding};
test('tenant and platform-approved price registry produce a no-write identity',()=>{
 const result=verifyServerOwnedStripeBillingBinding(valid);
 assert.equal(result.bindingValidated,true);
 assert.equal(result.entitlementAllowed,false);
 assert.equal(result.checkoutStarted,false);
});
test('mismatched tenant, Stripe account, mode, price, approval and checkout are refused',()=>{
 const cases=[
  {tenantId:planId},{accountId:'acct_Other'},
  {livemode:true},{stripePriceId:'price_Other'},
  {checkoutSessionId:'cs_live_Test1'},
  {approvedPrice:{...approvedPrice,status:'revoked'}},
  {approvedPrice:{...approvedPrice,approvedBy:'adminB'}},
  {binding:{...binding,tenantId:planId}},
  {binding:{...binding,customerId:'cus_Other'}},
  {binding:{...binding,status:'canceled'}},
 ];
 for(const change of cases)
  assert.throws(()=>verifyServerOwnedStripeBillingBinding({...valid,...change}));
});
