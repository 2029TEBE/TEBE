import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyPaddleSignature, paddleEventIdentity } from './paddle-webhook-signature.mjs';
import { evaluatePaddleSandboxSettlement } from './paddle-sandbox-settlement-policy.mjs';
import { validateServitroPaddlePlan } from '../infra/servitro-paddle-preflight.mjs';

// Pure synthetic contract: NEVER invoke a real Paddle API, DB, or settlement writer.
const now = 1793736000, secret = 'pdl_ntfset_synthetic_test_not_real_secret';
const tenantId = '11111111-1111-4111-8111-111111111111';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const event = () => ({
  event_id:'evt_'+'a'.repeat(26),event_type:'transaction.completed',
  data:{id:'txn_abc123',status:'completed',subscription_id:'sub_abc123',currency_code:'SAR',
    custom_data:{tenantId},
    details:{line_items:[{price:{id:'pri_abc123'},quantity:1}],totals:{grand_total:'11500'}}}
});
const intent=()=>({provider:'paddle',environment:'sandbox',tenantId,subscriptionId,
 transactionId:'txn_abc123',priceId:'pri_abc123',amountMinor:11500,
 currency:'SAR',expiresAt:now+60});
const raw=e=>Buffer.from(JSON.stringify(e));
const sign=data=>'ts='+now+';h1='+createHmac('sha256',secret).update(String(now)).update(':').update(data).digest('hex');
const verified=(payload,signature)=> {
 const bytes=raw(payload);
 const ok=verifyPaddleSignature(bytes,signature??sign(bytes),secret,now);
 const id=paddleEventIdentity(bytes,signature??sign(bytes),secret,now);
 const result=evaluatePaddleSandboxSettlement(payload,intent(),{signatureVerified:ok&&!!id,now});
 return {ok,id,result};
};

test('Q92 valid synthetic signed Paddle event yields persistence-required candidate, never paid access',()=>{
 const x=verified(event());
 assert.equal(x.ok,true);
 assert.equal(x.id?.id,event().event_id);
 assert.equal(x.result.accepted,true);
 assert.equal(x.result.requiresAtomicPersistence,true);
 assert.equal(x.result.tenantId,tenantId);
 assert.equal(Object.hasOwn(x.result,'entitlementGranted'),false);
 assert.equal(Object.hasOwn(x.result,'deploymentAuthorized'),false);
});
test('Q92 tampered raw Paddle payload fails signature before settlement candidate',()=>{
 const original=event(), originalSig=sign(raw(original));
 const tampered=structuredClone(original);
 tampered.data.details.totals.grand_total='999';
 const x=verified(tampered,originalSig);
 assert.equal(x.ok,false);
 assert.equal(x.id,null);
 assert.equal(x.result.accepted,false);
});
test('Q92 a correctly signed event cannot settle wrong tenant or unowned transaction',()=>{
 const e=event();
 e.data.custom_data.tenantId='other-tenant';
 const mismatch=verified(e);
 assert.equal(mismatch.ok,true);
 assert.equal(mismatch.result.accepted,false);
 const other=event();other.data.id='txn_other';
 assert.equal(verified(other).result.accepted,false);
});
test('Q92 verified event alone cannot pass staging deployment gate with billing enabled',()=>{
 const plan={
  releaseSha:'a'.repeat(40),imageDigest:'sha256:'+'b'.repeat(64),
  environment:'isolated-nonproduction',webOrigin:'https://staging.example.test',
  apiOrigin:'https://api.staging.example.test',mailTransport:'disabled',
  billingProvider:'paddle',paddleEnabled:false,stripeEnabled:false,
  paddleWebhookOrigin:'https://api.staging.example.test',
  paddleWebhookPath:'/billing/paddle/webhook',
  paddleSecretSource:'managed-secret-reference',databaseMigrationMode:'expand-only',
  backup:{encrypted:true,offHost:true,restoreTarget:'isolated-nonproduction'},
  rollback:{imageDigest:'sha256:'+'b'.repeat(64),manualApproval:true,databaseRollback:'none'},
  health:{url:'https://api.staging.example.test/health/ready',
    tlsVerify:true,networkProbeEnabled:false}
 };
 const a=validateServitroPaddlePlan(plan);
 assert.equal(a.ok,true);
 assert.equal(a.deploymentAuthorized,false);
 assert.equal(a.operationallyVerified,false);
 plan.paddleEnabled=true;
 assert.equal(validateServitroPaddlePlan(plan).ok,false);
});
