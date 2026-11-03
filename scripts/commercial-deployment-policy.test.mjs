import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCommercialRequest as evaluate } from './commercial-deployment-policy.mjs';
const tenantId='11111111-1111-4111-8111-111111111111';
const base={kind:'shared_saas',tenantId,billingAccountId:'acct_test_01',stripeMode:'test',approvedTestPriceId:'price_TEST123',currency:'sar',amountMinor:1500};
const req={tenantId,billingAccountId:'acct_test_01',mode:'test',action:'checkout',priceId:'price_TEST123',currency:'sar',amountMinor:1500};
test('only matching shared TEST checkout allowed, never provisioning',()=>assert.deepEqual(evaluate(req,base),{allowed:true,reason:'shared_test_checkout_only',checkout:true,provision:false}));
for(const [name,r,d] of [
 ['wrong tenant',{tenantId:'22222222-2222-4222-8222-222222222222'},{}],
 ['wrong account',{billingAccountId:'acct_other'},{}],
 ['live request',{mode:'live'},{}],
 ['live deployment',{}, {stripeMode:'live'}],
 ['wrong price',{priceId:'price_OTHER'},{}],
 ['wrong currency',{currency:'usd'},{}],
 ['wrong amount',{amountMinor:100},{}],
 ['government',{}, {government:true}],
 ['manual approval',{}, {approvalRequired:true}],
 ['dedicated checkout',{}, {kind:'dedicated_enterprise'}],
 ['missing billing account',{}, {billingAccountId:undefined}],
 ['unsupported action',{action:'provision'},{}],
]) test(name,()=>{const result=evaluate({...req,...r},{...base,...d});assert.equal(result.allowed,false);assert.equal(result.checkout,false);assert.equal(result.provision,false)});
test('dedicated quote is non-billable and non-provisioning',()=>assert.deepEqual(evaluate({...req,action:'request_quote'},{...base,kind:'dedicated_enterprise',government:true}),{allowed:true,reason:'manual_quote_only',checkout:false,provision:false}));
