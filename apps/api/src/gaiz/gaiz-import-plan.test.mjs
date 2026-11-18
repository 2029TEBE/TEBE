import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {buildReadOnlyGaizImportPlan} from './gaiz-import-plan.mjs';
const key=generateKeyPairSync('ed25519');
const tenant='11111111-1111-4111-8111-111111111111';
const request='22222222-2222-4222-8222-222222222222';
const reviewer='33333333-3333-4333-8333-333333333333';
const requestId='44444444-4444-4444-8444-444444444444';
const projectId='55555555-5555-4555-8555-555555555555';
const now=Date.parse('2026-11-16T12:00:00.000Z');
const artifactSha256='a'.repeat(64);
const payload={artifactId:'sample-1',artifactSha256,keyId:'recipient-1',recipientTenant:tenant,
 reportSha256:'b'.repeat(64),reviewId:requestId,timestamp:'2026-11-16T12:00:00.000Z',
 validation:'schema-validated-no-import'};
const custodianAttestation={payload,signature:sign(null,Buffer.from('GAIZ2-CUSTODY-RECEIPT\n'+JSON.stringify(Object.fromEntries(Object.keys(payload).sort().map(k=>[k,payload[k]])))),key.privateKey).toString('base64url')};
const args={context:{tenantId:tenant,userId:reviewer,capabilities:['pmoa_manage_projects']},
 review:{tenantId:tenant,id:requestId,requestedBy:request,reviewedBy:reviewer,status:'approved',
 sha256:artifactSha256,artifactId:'sample-1',issuerId:'issuer-1',expiresAt:'2026-11-17T12:00:00.000Z'},
 verifiedArtifact:{verified:true,tenantScope:tenant,sha256:artifactSha256,artifactId:'sample-1',issuerId:'issuer-1'},
 custodianAttestation,trustedCustodianPublicKey:key.publicKey,
 project:{tenantId:tenant,id:projectId,status:'active'},now};
test('approved attestation produces only read-only, empty import plan',()=>{
 const p=buildReadOnlyGaizImportPlan(args);
 assert.equal(p.importAllowed,false);assert.equal(p.appliesData,false);
 assert.deepEqual(p.proposedOperations,[]);
 assert.equal(p.requiresSeparateBusinessDataMapping,true);
 assert.doesNotMatch(JSON.stringify(p),/private|plaintext contents/);
});
test('wrong tenant, review, forged report, wrong project fail closed',()=>{
 for(const change of [
  {context:{...args.context,tenantId:'99999999-9999-4999-8999-999999999999'}},
  {review:{...args.review,reviewedBy:request}},
  {review:{...args.review,status:'pending'}},
  {review:{...args.review,expiresAt:'not-a-date'}},
  {verifiedArtifact:{...args.verifiedArtifact,sha256:'c'.repeat(64)}},
  {project:{...args.project,tenantId:'88888888-8888-4888-8888-888888888888'}},
  {trustedCustodianPublicKey:generateKeyPairSync('ed25519').publicKey},
 ])assert.throws(()=>buildReadOnlyGaizImportPlan({...args,...change}));
});
