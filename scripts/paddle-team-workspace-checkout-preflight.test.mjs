import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareVerifiedTeamWorkspaceCheckout as prepare } from './paddle-team-workspace-checkout-preflight.mjs';

const uuid = x => x.repeat(8)+'-'+x.repeat(4)+'-4'+x.repeat(3)+'-8'+x.repeat(3)+'-'+x.repeat(12);
const now = 1800000000000;
const runtime = () => ({deploymentEnv:'staging', paddleEnv:'sandbox',
  paddleEnabled:'false', billingProvider:'paddle'});
const binding = () => ({
  source:'locked-tenant-record', provider:'paddle', environment:'sandbox',
  planKey:'team_workspace_monthly',
  intentId:uuid('1'), tenantId:uuid('2'), invoiceId:uuid('5'),
  attemptId:uuid('6'), subscriptionId:uuid('3'),
  planId:uuid('4'), expiresAt:now+600000,
  planAmountMinor:4900, planCurrency:'USD', planInterval:'month', planFrequency:1,
});
const run = (b=binding(), e=runtime()) => prepare(b,e,{now});

test('prepares only verified $49 monthly Paddle sandbox transaction',()=>{
  const p=run();
  assert.equal(p.ok,true);
  assert.equal(p.verifiedProductId,'pro_01m6x789k8kmvez6zk7cm17wdz');
  assert.equal(p.expected.priceId,'pri_01m6x7w5zy16nktzjwg2ezas2d');
  assert.equal(p.expected.amountMinor,4900);
  assert.equal(p.expected.currency,'USD');
  assert.equal(p.apiOrigin,'https://sandbox-api.paddle.com');
  assert.deepEqual(p.request.items,[{price_id:p.expected.priceId,quantity:1}]);
  assert.deepEqual(p.request.custom_data,{
    epmo_intent_id:binding().intentId,
    epmo_attempt_id:binding().attemptId,
    epmo_invoice_id:binding().invoiceId,
    epmo_tenant_id:binding().tenantId,
  });
  assert.equal(p.collectionEnabled,false);
  assert.equal(p.entitlementGranted,false);
});

test('rejects tenant plan mismatch and cannot charge a different interval',()=>{
  for(const patch of [
    {planAmountMinor:1}, {planAmountMinor:4901}, {planCurrency:'SAR'},
    {planInterval:'year'}, {planFrequency:12}, {planAmountMinor:undefined}
  ]) assert.equal(run({...binding(),...patch}).ok,false);
});

test('rejects browser origins, forged price selectors and tenantless intents',()=>{
  for(const patch of [
    {source:'browser'}, {provider:'stripe'}, {environment:'production'},
    {planKey:'enterprise'}, {planKey:'pri_01m6x7w5zy16nktzjwg2ezas2d'},
    {tenantId:''}, {planId:'foreign'}, {expiresAt:now-1},
    {invoiceId:undefined}, {attemptId:undefined}
  ]) assert.equal(run({...binding(),...patch}).ok,false);
});

test('never prepares when production or payments enabled',()=>{
  for(const patch of [
    {deploymentEnv:'production'}, {paddleEnv:'production'},
    {paddleEnabled:'true'}, {billingProvider:'stripe'},
    {deploymentEnv:undefined}, {paddleEnabled:undefined}
  ]) {
    const p=run(binding(),{...runtime(),...patch});
    assert.equal(p.ok,false);
    assert.equal(p.collectionEnabled,false);
  }
});
