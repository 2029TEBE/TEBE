import test from 'node:test';
import assert from 'node:assert/strict';
import {auditStripeStagingWebhook,inspectStripeWebhookEndpoints}
  from './stripe-webhook-endpoint-audit.mjs';

const url='https://api-staging.theepmo.example/api/v1/billing/stripe-webhook';
const valid=()=>({
  BILLING_MODE:'stripe',BILLING_PROVIDER:'stripe',STRIPE_ENABLED:'true',DEPLOYMENT_ENV:'staging',
  NODE_ENV:'production',STRIPE_ALLOW_TEST_MODE_IN_PRODUCTION:'true',
  STRIPE_SECRET_KEY:'sk_test_'+'1'.repeat(20),
  STRIPE_WEBHOOK_SECRET:'whsec_'+'2'.repeat(24),
  WEB_ORIGIN:'https://staging.theepmo.example',
  STRIPE_WEBHOOK_PUBLIC_URL:url,
  DATABASE_URL:'postgres://pmo_app:local@127.0.0.1:5432/pmo',
  BILLING_REFERENCE_WEBHOOK_ENABLED:'false',
});
const events=['checkout.session.completed','checkout.session.async_payment_succeeded',
  'charge.refunded','charge.dispute.created','charge.dispute.closed'];
const endpoint=(changes={})=>({
  object:'webhook_endpoint',id:'we_test_12345',url,livemode:false,
  status:'enabled',enabled_events:events,...changes,
});
const listing=(items,has_more=false)=>({object:'list',data:items,has_more});
test('matching enabled test webhook with required events is ready',()=>{
  const r=inspectStripeWebhookEndpoints(listing([endpoint()]),url);
  assert.equal(r.ready,true);assert.deepEqual(r.requiredEvents,events);
});
test('absent endpoint fails, including an empty connected sandbox',()=>{
  assert.throws(()=>inspectStripeWebhookEndpoints(listing([]),url),/no matching/);
});
test('wrong mode, URL, inactive endpoint and missing events all fail closed',()=>{
  for(const changed of [
    {livemode:true},{status:'disabled'},{url:'https://other.example/handler'},
    {enabled_events:['checkout.session.completed']},
  ])assert.throws(()=>inspectStripeWebhookEndpoints(listing([endpoint(changed)]),url));
});
test('duplicate eligible destinations and incomplete pagination fail closed',()=>{
  assert.throws(()=>inspectStripeWebhookEndpoints(listing([endpoint(),endpoint({id:'we_another'})]),url));
  assert.throws(()=>inspectStripeWebhookEndpoints(listing([],true),url),/pagination/);
});
test('valid staging does only a GET to Stripe and returns no secret',async()=>{
  let calls=0;
  const mock=async(request,opts)=>{
    calls++;assert.equal(request,'https://api.stripe.com/v1/webhook_endpoints?limit=100');
    assert.equal(opts.method,'GET');
    assert.equal(opts.headers.Authorization,'Bearer '+valid().STRIPE_SECRET_KEY);
    return {status:200,json:async()=>listing([endpoint()])};
  };
  const r=await auditStripeStagingWebhook(valid(),mock);
  assert.equal(calls,1);assert.equal(r.ready,true);
  assert.equal(JSON.stringify(r).includes('sk_test_'),false);
});
test('wrong provider or enabled reference mode never makes a network call',async()=>{
  for(const changed of [
    {BILLING_PROVIDER:'reference'}, {STRIPE_ENABLED:'false'},
    {BILLING_REFERENCE_WEBHOOK_ENABLED:'true'},
    {STRIPE_SECRET_KEY:'sk_live_'+'1'.repeat(20)},
  ]){
    let calls=0;
    await assert.rejects(auditStripeStagingWebhook({...valid(),...changed},
      async()=>{calls++;throw Error('unexpected call')}),/configuration incomplete/);
    assert.equal(calls,0);
  }
});
test('Stripe API errors and non-JSON responses fail closed',async()=>{
  await assert.rejects(auditStripeStagingWebhook(valid(),async()=>({status:403})),/listing failed/);
  await assert.rejects(auditStripeStagingWebhook(valid(),async()=>({status:200,json:async()=>{throw Error('bad')}})),/invalid JSON/);
});
