import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {requestGaizCustodyValidation} from './gaiz-custody-bridge.mjs';

const signer=generateKeyPairSync('ed25519'),now=Date.parse('2026-11-16T12:00:00.000Z');
const context={tenantId:'synthetic-tenant',userId:'operator-1',capabilities:['pmoa_admin']};
const artifactSha256='a'.repeat(64),reportSha256='b'.repeat(64),reviewId='review-1';
const request={context,reviewId,artifactSha256,recipientKeyId:'customer-key',now};
const review={id:reviewId,tenantId:context.tenantId,requestedBy:'requester-1',
 reviewedBy:'reviewer-2',status:'approved',sha256:artifactSha256,
 artifactId:'report-1',issuerId:'issuer-1',expiresAt:'2026-11-17T00:00:00.000Z'};
const recipient={tenantScope:context.tenantId,keyId:'customer-key',status:'active',
 algorithm:'RSA-OAEP-SHA256',ownerType:'customer',
 activeFrom:'2026-01-01T00:00:00.000Z',activeUntil:'2027-01-01T00:00:00.000Z'};
const verification={verified:true,tenantScope:context.tenantId,sha256:artifactSha256,
 artifactId:review.artifactId,issuerId:review.issuerId};
function signed(overrides={}){
 const payload={artifactId:review.artifactId,artifactSha256,keyId:recipient.keyId,
  recipientTenant:context.tenantId,reportSha256,reviewId,
  timestamp:'2026-11-16T12:00:00.000Z',validation:'schema-validated-no-import',
  ...overrides};
 const text='GAIZ2-CUSTODY-RECEIPT\n'+JSON.stringify(Object.fromEntries(
  Object.keys(payload).sort().map(k=>[k,payload[k]])));
 return {payload,signature:sign(null,Buffer.from(text),signer.privateKey).toString('base64url')};
}
function makePort(options={}){
 const used=new Set(),events=[];
 const port={
  loadReview:async()=>options.review??review,
  loadRecipient:async()=>options.recipient??recipient,
  loadCustodianTrust:async()=>({tenantId:context.tenantId,status:'active',
   custodianId:'independent-custodian',publicKey:options.trustKey??signer.publicKey}),
  getVerifiedArtifact:async()=>options.verification??verification,
  reserveAttempt:async claim=>{
   const k=[claim.tenantId,claim.reviewId,claim.artifactSha256,claim.recipientKeyId].join('|');
   if(used.has(k))return {reserved:false};used.add(k);
   return {reserved:true,attemptId:'attempt-unique-01'};
  },
  requestAttestation:async()=>options.attestation??signed(),
  recordResult:async event=>{events.push(event);if(options.auditFail)throw Error('Audit store down');},
 };
 return {port,events};
}
test('verified custody receipt requires durable attempt; no import or plaintext',async()=>{
 const {port,events}=makePort();
 const result=await requestGaizCustodyValidation(request,{port});
 assert.equal(result.status,'attestation-validated-no-import');
 assert.equal(result.importAllowed,false);
 assert.equal(result.plaintextReleased,false);
 assert.equal(events.length,1);
 assert.equal(events[0].status,'validated');
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE KEY|governance report/);
 await assert.rejects(()=>requestGaizCustodyValidation(request,{port}),/replayed/);
});
test('cross tenant, wrong review, revoked recipient, wrong signer denied before key operation',async()=>{
 for(const override of [
  {request:{...request,context:{...context,tenantId:'other'}}},
  {options:{review:{...review,status:'pending'}}},
  {options:{review:{...review,reviewedBy:review.requestedBy}}},
  {options:{recipient:{...recipient,status:'revoked'}}},
  {options:{trustKey:generateKeyPairSync('ed25519').publicKey}},
  {options:{attestation:signed({keyId:'wrong-key'})}},
  {options:{attestation:signed({artifactId:'other-report'})}},
 ]){
  const {port}=makePort(override.options??{});
  await assert.rejects(()=>requestGaizCustodyValidation(
   override.request??request,{port}));
 }
});
test('failed audit or missing reservation denies receipt and cannot retry',async()=>{
 const {port}=makePort({auditFail:true});
 await assert.rejects(()=>requestGaizCustodyValidation(request,{port}),/refused/);
 await assert.rejects(()=>requestGaizCustodyValidation(request,{port}),/replayed/);
 const other=makePort();
 other.port.reserveAttempt=async()=>({reserved:false});
 await assert.rejects(()=>requestGaizCustodyValidation(request,{port:other.port}),/replayed/);
});
test('port and caller must be independently authenticated',async()=>{
 await assert.rejects(()=>requestGaizCustodyValidation(request,{}),/port/);
 await assert.rejects(()=>requestGaizCustodyValidation({...request,context:{...context,capabilities:[]}},{port:makePort().port}),/context/);
});
