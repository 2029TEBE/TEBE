import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRecurringProviderReadiness, readOnlyStripePriceCheck } from './stripe-recurring-provider-preflight.mjs';
const a = 'c47bf504-3bb0-4f81-9143-a155c0e1a117';
const b = 'c250de9d-a7bf-42fb-9d9e-113f303e1ef6';
const good = {
  EPMO_STRIPE_TEST_AUTHORIZATION:'YES_AUTHORIZED_TEST_ONLY', DEPLOYMENT_ENV:'staging', STRIPE_ENABLED:'true',
  STRIPE_TEST_OPERATOR_ENABLED:'true', STRIPE_RECURRING_CHECKOUT_ENABLED:'true',
  STRIPE_SECRET_KEY:'sk_test_1234567890123456', STRIPE_WEBHOOK_SECRET:'whsec_1234567890123456',
  STRIPE_TEST_OPERATOR_SECRET:'a'.repeat(40), WEB_ORIGIN:'https://staging.theepmo.com',
  STRIPE_WEBHOOK_PUBLIC_URL:'https://api-staging.theepmo.com/api/v1/billing/stripe-webhook',
  STRIPE_RECURRING_PRICE_IDS:JSON.stringify({business:'price_Test12345'}),
  EPMO_STRIPE_TEST_TENANT_A:a, EPMO_STRIPE_TEST_TENANT_B:b,
  EPMO_STRIPE_TEST_EXACT_SHA:'f'.repeat(40), EPMO_STRIPE_TEST_DEPLOYED_SHA:'f'.repeat(40),
  EPMO_STRIPE_TEST_REVIEWER:'Independent QA', BILLING_REFERENCE_WEBHOOK_ENABLED:'false',
  NODE_ENV:'production', STRIPE_ALLOW_TEST_MODE_IN_PRODUCTION:'true',
};
const blocked = env => checkRecurringProviderReadiness(env).checks.filter(c=>!c.passed).map(c=>c.name);
test('synthetic complete readiness checks only configuration, never provider acceptance',()=>{
  const r=checkRecurringProviderReadiness(good); assert.equal(r.ready,true);assert.equal(r.prices.length,1);
});
test('missing authorization, LIVE key and missing operator secret fail closed',()=>{
  for (const delta of [{EPMO_STRIPE_TEST_AUTHORIZATION:''},{STRIPE_SECRET_KEY:'sk_live_1234567890123456'},
    {STRIPE_TEST_OPERATOR_SECRET:''},{DEPLOYMENT_ENV:'production'}]) assert.ok(blocked({...good,...delta}).length);
});
test('wrong webhook host, HTTP, query, spoofed hostname fail closed',()=>{
  for (const url of ['https://staging.theepmo.com/api/v1/billing/stripe-webhook',
    'http://api-staging.theepmo.com/api/v1/billing/stripe-webhook',
    'https://api-staging.theepmo.com/api/v1/billing/stripe-webhook?token=x',
    'https://api-staging.theepmo.com.attacker.test/api/v1/billing/stripe-webhook'])
    assert.ok(blocked({...good,STRIPE_WEBHOOK_PUBLIC_URL:url}).length);
});
test('rejects malformed Price map, duplicate prices, and tenant reuse',()=>{
  for (const raw of ['{}','{"a":"price_X","b":"price_X"}','{"a":"price_live!"}'])
    assert.ok(blocked({...good,STRIPE_RECURRING_PRICE_IDS:raw}).length);
  assert.ok(blocked({...good,EPMO_STRIPE_TEST_TENANT_B:a}).length);
});
test('rejects absent or mismatched immutable SHA and missing reviewer',()=>{
  assert.ok(blocked({...good,EPMO_STRIPE_TEST_DEPLOYED_SHA:'e'.repeat(40)}).length);
  assert.ok(blocked({...good,EPMO_STRIPE_TEST_REVIEWER:''}).length);
});
test('no provider request when authorization absent',async()=>{
  let called=false;
  await assert.rejects(readOnlyStripePriceCheck({...good,EPMO_STRIPE_TEST_AUTHORIZATION:''},()=>{called=true;}),/BLOCKED/);
  assert.equal(called,false);
});
test('read-only TEST Price check rejects provider LIVE and nonrecurring Price',async()=>{
  const request=[];
  const fetcher=async(url,opts)=>{request.push({url,method:opts.method,redirect:opts.redirect});
    return {status:200,json:async()=>({id:'price_Test12345',object:'price',livemode:true,active:true,type:'recurring',recurring:{interval:'month'},currency:'sar',unit_amount:1000})};};
  await assert.rejects(readOnlyStripePriceCheck(good,fetcher),/mismatch/);
  assert.deepEqual(request,[{url:'https://api.stripe.com/v1/prices/price_Test12345',method:'GET',redirect:'error'}]);
});
test('synthetic read-only TEST Price response never counts any of seven receipts',async()=>{
  const r=await readOnlyStripePriceCheck(good,async()=>({status:200,json:async()=>({id:'price_Test12345',object:'price',livemode:false,active:true,type:'recurring',recurring:{interval:'month'},currency:'sar',unit_amount:1000})}));
  assert.equal(r.checkedPrices,1);assert.equal(r.providerReceiptsAccepted,0);assert.equal(r.releaseAccepted,false);
});
