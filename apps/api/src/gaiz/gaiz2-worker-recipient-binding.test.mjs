import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,createCipheriv,publicEncrypt,sign,constants} from 'node:crypto';
import {bindGaiz2RecipientWorkerCandidate,bindGaiz2RecipientWithSignedCredentialCandidate} from './gaiz2-worker-recipient-binding.mjs';

const tenantId='11111111-1111-4111-8111-111111111111';
const workItemId='22222222-2222-4222-8222-222222222222';
const workerId='33333333-3333-4333-8333-333333333333';
const assignmentId='44444444-4444-4444-8444-444444444444';
const nowMs=1800000000050;
const assignIssuer=generateKeyPairSync('ed25519');
const gaizIssuer=generateKeyPairSync('ed25519');
const recipient=generateKeyPairSync('rsa',{modulusLength:3072});
const canon=x=>Array.isArray(x)?'['+x.map(canon).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}':JSON.stringify(x);
const b64=x=>Buffer.from(x).toString('base64url');
const workload=()=>({workerId,role:'gaiz_verify_worker',credentialIssuer:'synthetic-mtls-CA',credentialExpiresAtMs:1800000090000});
const token=()=>{const claims={version:1,workerId,tenantId,workItemId,purpose:'gaiz_verify_worker',assignmentId,issuedAtMs:1800000000000,expiresAtMs:1800000060000};return b64(JSON.stringify({claims,signature:b64(sign(null,Buffer.from('GAIZ_WORKER_ASSIGNMENT_V1\n'+canon(claims)),assignIssuer.privateKey))}));};
const file=()=>{const dek=randomBytes(32),nonce=randomBytes(12),manifest={version:2,schemaVersion:1,contentType:'application/vnd.orgaiz.report+json',artifactId:'synthetic-inert',issuerId:'synthetic-issuer',tenantScope:tenantId,createdAt:'2026-11-16T00:00:00.000Z'};const cipher=createCipheriv('aes-256-gcm',dek,nonce);cipher.setAAD(Buffer.from(canon(manifest)));const ciphertext=Buffer.concat([cipher.update(Buffer.from(canon({title:'Synthetic'}))),cipher.final()]);const wrappedKey=publicEncrypt({key:recipient.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},dek);dek.fill(0);const unsigned={ciphertext:b64(ciphertext),manifest,nonce:b64(nonce),recipients:[{keyId:'synthetic-recipient',wrappedKey:b64(wrappedKey)}],tag:b64(cipher.getAuthTag())};return Buffer.from('GAIZ2\n'+canon({...unsigned,signature:b64(sign(null,Buffer.from('GAIZ2\n'+canon(unsigned)),gaizIssuer.privateKey))}));};
const opts=()=>({signedAssignment:token(),trustedAssignmentIssuerPublicKey:assignIssuer.publicKey,trustedGaizIssuerPublicKey:gaizIssuer.publicKey,expectedIssuerId:'synthetic-issuer',expectedTenantScope:tenantId,recipientKeyId:'synthetic-recipient',tenantId,workItemId,workload:workload(),nowMs});
const within=async cb=>{const before=process.env.NODE_ENV,flag=process.env.GAIZ_DEV_ONLY;try{process.env.NODE_ENV='test';process.env.GAIZ_DEV_ONLY='true';return await cb()}finally{if(before===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=before;if(flag===undefined)delete process.env.GAIZ_DEV_ONLY;else process.env.GAIZ_DEV_ONLY=flag}};

test('valid dual signature binds verifier work item to signed ciphertext without release',()=>within(()=>{
 const r=bindGaiz2RecipientWorkerCandidate(file(),opts());
 assert.equal(r.assignmentId,assignmentId);assert.equal(r.tenantId,tenantId);
 assert.equal(r.artifactId,'synthetic-inert');assert.equal(r.purpose,'verify-metadata-only');
 assert.equal(r.databaseClaimRequired,true);assert.equal(r.custodyAuthorizationRequired,true);
 assert.equal(r.authorizationGranted,false);assert.equal(r.importAllowed,false);
 assert.equal(Object.isFrozen(r),true);
 assert.equal(Object.hasOwn(r,'dek'),false);assert.equal(Object.hasOwn(r,'plaintext'),false);
}));
test('wrong work item, trust, credential, artifact, recipient and tenant fail closed',()=>within(()=>{
 const bytes=file();for(const changes of [
  {workItemId:workerId},{tenantId:workerId},{expectedTenantScope:'another-tenant'},
  {trustedGaizIssuerPublicKey:generateKeyPairSync('ed25519').publicKey},
  {trustedAssignmentIssuerPublicKey:generateKeyPairSync('ed25519').publicKey},
  {recipientKeyId:'unknown-key'},{workload:{...workload(),role:'gaiz_execute_worker'}},
  {workload:{...workload(),credentialExpiresAtMs:nowMs}},
  {nowMs:1800000060000},
 ])assert.throws(()=>bindGaiz2RecipientWorkerCandidate(bytes,{...opts(),...changes}));
 const tampered=Buffer.from(bytes);tampered[tampered.length-3]^=1;
 assert.throws(()=>bindGaiz2RecipientWorkerCandidate(tampered,opts()));
}));
test('production and opt-out reject binding regardless of valid signatures',async()=>{
 const bytes=file();const prior=process.env.NODE_ENV,flag=process.env.GAIZ_DEV_ONLY;
 try{
  process.env.NODE_ENV='production';process.env.GAIZ_DEV_ONLY='true';
  assert.throws(()=>bindGaiz2RecipientWorkerCandidate(bytes,opts()));
  process.env.NODE_ENV='test';process.env.GAIZ_DEV_ONLY='false';
  assert.throws(()=>bindGaiz2RecipientWorkerCandidate(bytes,opts()));
 }finally{
  if(prior===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=prior;
  if(flag===undefined)delete process.env.GAIZ_DEV_ONLY;else process.env.GAIZ_DEV_ONLY=flag;
 }
});

const credentialIssuer=generateKeyPairSync('ed25519');
const challenge=randomBytes(32).toString('base64url');
const signedCredential=(mod={})=>{
 const claims={version:1,issuerId:'synthetic-independent-issuer',workerId,
   role:'gaiz_verify_worker',challenge,
   issuedAtMs:1800000000000,expiresAtMs:1800000030000,...mod};
 return b64(JSON.stringify({claims,signature:b64(sign(null,Buffer.from(
   'GAIZ_WORKLOAD_CREDENTIAL_V1\n'+canon(claims)),credentialIssuer.privateKey))}));
};
const credentialOpts=()=>({
 ...opts(),
 signedWorkloadCredential:signedCredential(),
 trustedCredentialIssuerPublicKey:credentialIssuer.publicKey,
 expectedCredentialIssuerId:'synthetic-independent-issuer',
 expectedWorkerId:workerId,
 expectedChallenge:challenge,
});

test('triple-independent-signature candidate ignores forged workload description',()=>within(()=>{
 const r=bindGaiz2RecipientWithSignedCredentialCandidate(file(),{
   ...credentialOpts(),
   workload:{...workload(),workerId:workItemId,role:'gaiz_execute_worker'},
 });
 assert.equal(r.workerId,workerId);
 assert.equal(r.credentialIssuer,'synthetic-independent-issuer');
 assert.equal(r.importAllowed,false);
 assert.equal(r.custodyAuthorizationRequired,true);
}));

test('invalid workload credential prevents signed recipient binding',()=>within(()=>{
 const bytes=file();
 for(const change of [
  {expectedChallenge:randomBytes(32).toString('base64url')},
  {expectedWorkerId:workItemId},
  {trustedCredentialIssuerPublicKey:generateKeyPairSync('ed25519').publicKey},
  {signedWorkloadCredential:signedCredential({role:'gaiz_execute_worker'})},
  {signedWorkloadCredential:signedCredential({expiresAtMs:1800000200000})},
 ])assert.throws(()=>bindGaiz2RecipientWithSignedCredentialCandidate(bytes,{
  ...credentialOpts(),...change,
 }));
}));
