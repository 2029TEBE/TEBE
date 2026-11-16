import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateGaiz2ReleaseEligibility as evaluate} from './gaiz2-key-release-eligibility.mjs';
const tenantId='11111111-1111-4111-8111-111111111111';
const workerId='22222222-2222-4222-8222-222222222222';
const workItemId='33333333-3333-4333-8333-333333333333';
const assignmentId='44444444-4444-4444-8444-444444444444';
const tx='55555555-5555-4555-8555-555555555555';
const nowMs=1800000000000;
const expected={tenantId,workerId,workItemId,assignmentId,
 artifactId:'artifact-1',envelopeSha256:'a'.repeat(64),recipientKeyId:'key-1'};
const make=()=>({
 expected:{...expected},
 verifiedEnvelope:{...expected,signedEnvelopeVerified:true,issuerTrusted:true},
 verifiedCustodyPolicy:{...expected,signedCustodyPolicyVerified:true,independentKmsAuthorizationRequired:true},
 grantClaim:{...expected,tokenSha256:'b'.repeat(64),claimAcquired:true,
  dbRole:'gaiz_verify_worker',databaseTransactionId:tx,expiresAtMs:nowMs+12000},
 assignmentClaim:{...expected,claimAcquired:true,dbRole:'gaiz_verify_worker',databaseTransactionId:tx},
 recipientKey:{tenantId,recipientKeyId:'key-1',keyVersion:'v1',state:'active',
  notBeforeMs:nowMs-20000,notAfterMs:nowMs+20000,revokedAtMs:null,
  dbRole:'gaiz_key_registry_reader',databaseTransactionId:tx},
 nowMs,
});
const reject=(mutate)=>{const x=make();mutate(x);assert.throws(()=>evaluate(x),/denied/)};
test('eligible evidence is still not KMS authorization',()=>{
 const before=process.env.GAIZ_DEV_ONLY;const node=process.env.NODE_ENV;
 try{
  process.env.GAIZ_DEV_ONLY='true';process.env.NODE_ENV='test';
  const out=evaluate(make());
  assert.equal(out.releaseCandidateEligible,true);
  assert.equal(out.kmsReleaseAllowed,false);
  assert.equal(out.importAllowed,false);
  assert.equal(Object.isFrozen(out),true);
 }finally{
  if(before===undefined)delete process.env.GAIZ_DEV_ONLY;else process.env.GAIZ_DEV_ONLY=before;
  if(node===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=node;
 }
});
test('rejects forged, expired, revoked, cross-tenant and replay evidence',()=>{
 const before=process.env.GAIZ_DEV_ONLY;const node=process.env.NODE_ENV;
 try{
  process.env.GAIZ_DEV_ONLY='true';process.env.NODE_ENV='test';
  reject(x=>{x.verifiedEnvelope.signedEnvelopeVerified=false});
  reject(x=>{x.verifiedCustodyPolicy.signedCustodyPolicyVerified=false});
  reject(x=>{x.grantClaim.claimAcquired=false});
  reject(x=>{x.assignmentClaim.claimAcquired=false});
  reject(x=>{x.grantClaim.dbRole='pmo_app'});
  reject(x=>{x.recipientKey.dbRole='pmo_app'});
  reject(x=>{x.recipientKey.state='revoked'});
  reject(x=>{x.recipientKey.revokedAtMs=nowMs-1});
  reject(x=>{x.recipientKey.notAfterMs=nowMs});
  reject(x=>{x.recipientKey.notBeforeMs=nowMs+1});
  reject(x=>{x.grantClaim.expiresAtMs=nowMs});
  reject(x=>{x.assignmentClaim.tenantId='66666666-6666-4666-8666-666666666666'});
  reject(x=>{x.recipientKey.tenantId='66666666-6666-4666-8666-666666666666'});
  reject(x=>{x.recipientKey.databaseTransactionId='77777777-7777-4777-8777-777777777777'});
  reject(x=>{x.grantClaim.tokenSha256='invalid'});
  reject(x=>{x.expected.untrusted=true});
 }finally{
  if(before===undefined)delete process.env.GAIZ_DEV_ONLY;else process.env.GAIZ_DEV_ONLY=before;
  if(node===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=node;
 }
});
test('production is always disabled',()=>{
 const before=process.env.GAIZ_DEV_ONLY;const node=process.env.NODE_ENV;
 try{
  process.env.GAIZ_DEV_ONLY='true';process.env.NODE_ENV='production';
  assert.throws(()=>evaluate(make()),/denied/);
  process.env.NODE_ENV='test';delete process.env.GAIZ_DEV_ONLY;
  assert.throws(()=>evaluate(make()),/denied/);
 }finally{
  if(before===undefined)delete process.env.GAIZ_DEV_ONLY;else process.env.GAIZ_DEV_ONLY=before;
  if(node===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=node;
 }
});
