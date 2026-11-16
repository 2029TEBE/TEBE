import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {claimGaiz2CustodyGrantInTransaction} from './gaiz2-custody-grant-claim.mjs';
const pair=generateKeyPairSync('ed25519'),nowMs=1800000000050;
const expected={
 tenantId:'11111111-1111-4111-8111-111111111111',
 workerId:'33333333-3333-4333-8333-333333333333',
 workItemId:'22222222-2222-4222-8222-222222222222',
 assignmentId:'44444444-4444-4444-8444-444444444444',
 artifactId:'synthetic',artifactIssuerId:'synthetic-issuer',
 envelopeSha256:'a'.repeat(64),recipientKeyId:'synthetic-recipient',
};
const canon=o=>'{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+JSON.stringify(o[k])).join(',')+'}';
function token(changes={},privateKey=pair.privateKey){
 const claims={version:1,issuerId:'custody-issuer',...expected,purpose:'gaiz2_metadata_preview',
  issuedAtMs:1800000000000,expiresAtMs:1800000020000,...changes};
 return Buffer.from(JSON.stringify({claims,signature:sign(null,Buffer.from(
  'GAIZ2_CUSTODY_GRANT_V1\n'+canon(claims)),privateKey).toString('base64url')})).toString('base64url');
}
const options=()=>({signedGrantToken:token(),trustedCustodyIssuerPublicKey:pair.publicKey,
 expectedCustodyIssuerId:'custody-issuer',expected,nowMs});
const dev=async fn=>{
 const old=process.env.NODE_ENV,flag=process.env.GAIZ_DEV_ONLY;
 try{process.env.NODE_ENV='test';process.env.GAIZ_DEV_ONLY='true';return await fn()}
 finally{
  if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old;
  if(flag===undefined)delete process.env.GAIZ_DEV_ONLY;else process.env.GAIZ_DEV_ONLY=flag;
 }
};
const fake=({role='gaiz_verify_worker',tenant=expected.tenantId,repeat=false}={})=>{
 let calls=0;
 const digest=createHash('sha256').update(Buffer.from(token(),'base64url')).digest('hex');
 return {get calls(){return calls},execute:async()=>{
  calls++;
  if(calls===1)return [{dbRole:role,currentTenant:tenant}];
  return repeat?[]:[{tokenSha256:digest}];
 }};
};
test('signed grant is checked before one-time database claim; never enables KMS',()=>dev(async()=>{
 const tx=fake(),r=await claimGaiz2CustodyGrantInTransaction(tx,options());
 assert.equal(tx.calls,2);
 assert.equal(r.claimAcquired,true);
 assert.equal(r.independentKmsAuthorizationRequired,true);
 assert.equal(r.assignmentClaimRequired,true);
 assert.equal(r.kmsReleaseAllowed,false);assert.equal(r.importAllowed,false);
 assert.equal(Object.isFrozen(r),true);
 assert.equal(Object.hasOwn(r,'wrappedKey'),false);
}));
test('wrong DB identity and replay are rejected',()=>dev(async()=>{
 for(const tx of [fake({role:'pmo_app'}),fake({tenant:expected.workItemId}),fake({repeat:true})])
  await assert.rejects(claimGaiz2CustodyGrantInTransaction(tx,options()));
}));
test('invalid signature or tenant is refused without DB access',()=>dev(async()=>{
 for(const mutate of [
  {signedGrantToken:token({tenantId:expected.workItemId})},
  {signedGrantToken:token({purpose:'gaiz2_import'})},
  {signedGrantToken:token({expiresAtMs:nowMs})},
  {trustedCustodyIssuerPublicKey:generateKeyPairSync('ed25519').publicKey},
  {expected:{...expected,recipientKeyId:'other-recipient'}},
 ]){
  const tx=fake();
  await assert.rejects(claimGaiz2CustodyGrantInTransaction(tx,{...options(),...mutate}));
  assert.equal(tx.calls,0);
 }
}));
test('production gate refuses all claims before accessing database',async()=>{
 const old=process.env.NODE_ENV,flag=process.env.GAIZ_DEV_ONLY;
 try{
  process.env.NODE_ENV='production';process.env.GAIZ_DEV_ONLY='true';
  const tx=fake();
  await assert.rejects(claimGaiz2CustodyGrantInTransaction(tx,options()));
  assert.equal(tx.calls,0);
 }finally{
  if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old;
  if(flag===undefined)delete process.env.GAIZ_DEV_ONLY;else process.env.GAIZ_DEV_ONLY=flag;
 }
});
