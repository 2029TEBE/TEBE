import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyCustodianAttestation} from './gaiz-custody-attestation.mjs';
// Independently emit the TO receipt wire format using Node crypto.
const issuer=generateKeyPairSync('ed25519');
const now=Date.parse('2026-11-16T12:00:00.000Z');
const payload={artifactId:'synthetic-01',artifactSha256:'a'.repeat(64),keyId:'customer-1',
 recipientTenant:'tenant-a',reportSha256:'b'.repeat(64),reviewId:'review-1',
 timestamp:'2026-11-16T12:00:00.000Z',validation:'schema-validated-no-import'};
const signed={payload,signature:sign(null,Buffer.from('GAIZ2-CUSTODY-RECEIPT\n'+JSON.stringify(Object.fromEntries(Object.keys(payload).sort().map(k=>[k,payload[k]])))),issuer.privateKey).toString('base64url')};
const policy={trustedCustodianPublicKey:issuer.publicKey,tenantId:'tenant-a',expectedArtifactSha256:payload.artifactSha256,expectedReviewId:'review-1',now};
test('TEBE independently verifies signed custody digest but denies import',()=>{
 const result=verifyCustodianAttestation(signed,policy);
 assert.equal(result.cryptographicAttestationVerified,true);
 assert.equal(result.importAllowed,false);
 assert.equal(result.decryptAllowed,false);
});
test('cross tenant, expired, forged digest and untrusted key denied',()=>{
 assert.throws(()=>verifyCustodianAttestation(signed,{...policy,tenantId:'tenant-b'}));
 assert.throws(()=>verifyCustodianAttestation(signed,{...policy,now:now+300001}));
 assert.throws(()=>verifyCustodianAttestation({...signed,payload:{...payload,reportSha256:'c'.repeat(64)}},policy));
 assert.throws(()=>verifyCustodianAttestation(signed,{...policy,trustedCustodianPublicKey:generateKeyPairSync('ed25519').publicKey}));
});
