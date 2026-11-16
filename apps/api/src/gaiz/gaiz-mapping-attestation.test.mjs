import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyMappingPreviewReceipt} from './gaiz-mapping-attestation.mjs';
const keys=generateKeyPairSync('ed25519');
const uuid=x=>String(x).padStart(8,'0')+'-1111-4111-8111-111111111111';
const payload={
 tenantId:uuid(1),stagingReviewId:uuid(2),artifactSha256:'a'.repeat(64),
 reportSha256:'b'.repeat(64),targetId:uuid(3),targetKind:'project',
 targetSnapshotSha256:'c'.repeat(64),revision:4,
 mappingProfileId:'approved-project-name',previewSha256:'d'.repeat(64),
 custodianId:'independent-custodian',issuedAt:'2026-11-16T13:00:00.000Z',
 expiresAt:'2026-11-16T13:05:00.000Z',purpose:'metadata-preview-only'
};
const signPayload=p=>({
 payload:p,signature:sign(null,Buffer.from('GAIZ2-MAPPING-PREVIEW\n'+
 JSON.stringify(Object.fromEntries(Object.keys(p).sort().map(k=>[k,p[k]])))),keys.privateKey).toString('base64url')
});
const expect={...payload,trustedCustodianPublicKey:keys.publicKey,
 now:Date.parse('2026-11-16T13:02:00.000Z')};
test('approved custodian digest is verified without authorization to import',()=>{
 const res=verifyMappingPreviewReceipt(signPayload(payload),expect);
 assert.equal(res.importAllowed,false);assert.equal(res.appliesData,false);
 assert.equal(res.containsPlaintext,false);
});
test('tampering, replay expiry, swapped tenant, profile, and custodian deny',()=>{
 for(const x of [
  {expect:{...expect,tenantId:uuid(4)}},
  {expect:{...expect,mappingProfileId:'other'}},
  {expect:{...expect,custodianId:'attacker'}},
  {expect:{...expect,now:Date.parse(payload.expiresAt)}},
  {expect:{...expect,trustedCustodianPublicKey:generateKeyPairSync('ed25519').publicKey}},
  {attestation:{...signPayload(payload),payload:{...payload,revision:5}}},
  {attestation:signPayload({...payload,purpose:'auto-import'})},
 ])assert.throws(()=>verifyMappingPreviewReceipt(x.attestation??signPayload(payload),x.expect??expect));
});
