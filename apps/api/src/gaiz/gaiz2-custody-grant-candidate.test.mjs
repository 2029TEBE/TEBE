import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyGaiz2CustodyGrantCandidate} from './gaiz2-custody-grant-candidate.mjs';

const issuer=generateKeyPairSync('ed25519');
const nowMs=1800000000050;
const expected=()=>({
 tenantId:'11111111-1111-4111-8111-111111111111',
 workerId:'33333333-3333-4333-8333-333333333333',
 workItemId:'22222222-2222-4222-8222-222222222222',
 assignmentId:'44444444-4444-4444-8444-444444444444',
 artifactId:'synthetic-artifact',
 artifactIssuerId:'orgaiz-synthetic',
 envelopeSha256:'a'.repeat(64),
 recipientKeyId:'synthetic-recipient',
});
const canonical=x=>'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+JSON.stringify(x[k])).join(',')+'}';
const token=(changes={},key=issuer.privateKey)=>{
 const claims={
  version:1,issuerId:'synthetic-custody-policy-issuer',
  ...expected(),purpose:'gaiz2_metadata_preview',
  issuedAtMs:1800000000000,expiresAtMs:1800000020050,...changes,
 };
 const sig=sign(null,Buffer.from('GAIZ2_CUSTODY_GRANT_V1\n'+canonical(claims)),key);
 return Buffer.from(JSON.stringify({claims,signature:sig.toString('base64url')})).toString('base64url');
};
const args=()=>({
 trustedCustodyIssuerPublicKey:issuer.publicKey,
 expectedCustodyIssuerId:'synthetic-custody-policy-issuer',
 expected:expected(),nowMs,
});
const dev=fn=>{
 const prior=process.env.GAIZ_DEV_ONLY,node=process.env.NODE_ENV;
 try{process.env.GAIZ_DEV_ONLY='true';process.env.NODE_ENV='test';return fn()}
 finally{
  if(prior===undefined)delete process.env.GAIZ_DEV_ONLY;else process.env.GAIZ_DEV_ONLY=prior;
  if(node===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=node;
 }
};
test('signed independent custody policy only evaluates one inert recipient',()=>dev(()=>{
 const r=verifyGaiz2CustodyGrantCandidate(token(),args());
 assert.equal(r.envelopeSha256,'a'.repeat(64));
 assert.equal(r.signedCustodyPolicyVerified,true);
 assert.equal(r.independentKmsAuthorizationRequired,true);
 assert.equal(r.kmsReleaseAllowed,false);
 assert.equal(r.importAllowed,false);
 assert.equal(r.authorizationGranted,false);
 assert.equal(Object.isFrozen(r),true);
 assert.equal(Object.hasOwn(r,'dek'),false);
 assert.equal(Object.hasOwn(r,'wrappedKey'),false);
}));
test('wrong custodian trust, recipient, assignment, worker or tenant rejects grant',()=>dev(()=>{
 const other=generateKeyPairSync('ed25519');
 for(const change of [
  {trustedCustodyIssuerPublicKey:other.publicKey},
  {expectedCustodyIssuerId:'other-issuer'},
  {expected:{...expected(),recipientKeyId:'different'}},
  {expected:{...expected(),tenantId:'55555555-5555-4555-8555-555555555555'}},
  {expected:{...expected(),assignmentId:'55555555-5555-4555-8555-555555555555'}},
  {expected:{...expected(),workerId:'55555555-5555-4555-8555-555555555555'}},
  {expected:{...expected(),envelopeSha256:'b'.repeat(64)}},
 ])assert.throws(()=>verifyGaiz2CustodyGrantCandidate(token(),{...args(),...change}));
 assert.throws(()=>verifyGaiz2CustodyGrantCandidate(token({},other.privateKey),args()));
}));
test('expired, future, forged purpose, oversized TTL, and unknown field reject grant',()=>dev(()=>{
 for(const mutation of [
  {expiresAtMs:nowMs},
  {issuedAtMs:nowMs+1},
  {issuedAtMs:1800000000000,expiresAtMs:1800000100000},
  {purpose:'gaiz2_import'},
  {version:2},
  {override:true},
 ])assert.throws(()=>verifyGaiz2CustodyGrantCandidate(token(mutation),args()));
}));
test('noncanonical duplicated or unsigned JSON grant is rejected',()=>dev(()=>{
 const base=Buffer.from(token(),'base64url').toString('utf8');
 for(const text of [
  ' '+base,
  base.replace('"version":1','"version":1,"version":1'),
  JSON.stringify({claims:{},signature:'AA'}),
 ])assert.throws(()=>verifyGaiz2CustodyGrantCandidate(Buffer.from(text).toString('base64url'),args()));
 assert.throws(()=>verifyGaiz2CustodyGrantCandidate('!',args()));
}));
test('production or absent explicit developer gate always deny',()=>{
 const before=process.env.NODE_ENV,prior=process.env.GAIZ_DEV_ONLY;
 try{
  process.env.NODE_ENV='production';process.env.GAIZ_DEV_ONLY='true';
  assert.throws(()=>verifyGaiz2CustodyGrantCandidate(token(),args()));
  process.env.NODE_ENV='test';process.env.GAIZ_DEV_ONLY='false';
  assert.throws(()=>verifyGaiz2CustodyGrantCandidate(token(),args()));
 }finally{
  if(before===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=before;
  if(prior===undefined)delete process.env.GAIZ_DEV_ONLY;else process.env.GAIZ_DEV_ONLY=prior;
 }
});
