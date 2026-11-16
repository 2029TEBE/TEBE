import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createPublicKey} from 'node:crypto';
import {createGaizTrustPolicy} from './gaiz-trust.mjs';
import {previewGaizWithCustodyCandidate} from './gaiz-key-custody-candidate.mjs';

const dir=dirname(fileURLToPath(import.meta.url));
const fixture=JSON.parse(readFileSync(resolve(dir,'fixtures/to-producer-synthetic-v1.json'),'utf8'));
const bytes=Buffer.from(fixture.envelopeBase64,'base64');
const tenant='tenant-interoperability', keyId='synthetic-key-1';
const now=1700000000050;
const context=()=>({authenticated:true,entitled:true,workspaceMember:true,
  tenantId:tenant,userId:'synthetic-actor',capabilities:['read']});
const trust=()=>createGaizTrustPolicy([{
  keyId,publicKey:createPublicKey(fixture.publicKeyPem),
  notBefore:1700000000000,notAfter:1700000060000,revoked:false,
}]);
const opts=(provider)=>({expectedTenantScope:tenant,issuerKeyId:keyId,
  context:context(),trustPolicy:trust(),custodyProvider:provider,now});

test('custody preview uses a backend policy and emits only inert metadata',async()=>{
  const original=Buffer.from(fixture.dekHex,'hex');
  const provider={releaseSyntheticDek:async claim=>{
    assert.equal(claim.tenantId,tenant);
    assert.equal(claim.purpose,'synthetic-preview-only');
    assert.equal(claim.issuerKeyId,keyId);
    assert.equal(claim.envelopeSha256,fixture.sha256);
    assert.equal(Object.isFrozen(claim),true);
    return original;
  }};
  const result=await previewGaizWithCustodyCandidate(bytes,opts(provider));
  assert.equal(result.preview.title,'Synthetic governance report');
  assert.equal(result.authorizedToImport,false);
  assert.equal(result.syntheticCandidateOnly,true);
  assert.equal(result.envelopeSha256,fixture.sha256);
  // The preview erases a private copy, not the custodian-owned original.
  assert.equal(original.toString('hex'),fixture.dekHex);
});

test('no key release when signature, tenant, issuer or entitlement fail',async()=>{
  let releases=0;
  const provider={releaseSyntheticDek:async()=>{releases++;return Buffer.from(fixture.dekHex,'hex')}};
  const bad=Buffer.from(bytes);bad[bad.length-5]^=1;
  for(const changed of [
    {expectedTenantScope:'another-tenant'},
    {issuerKeyId:'not-allowed'},
    {context:{...context(),entitled:false}},
    {trustPolicy:createGaizTrustPolicy([{
      keyId,publicKey:createPublicKey(fixture.publicKeyPem),
      notBefore:1700000000000,notAfter:1700000060000,revoked:true,
    }])},
  ])await assert.rejects(previewGaizWithCustodyCandidate(bytes,{...opts(provider),...changed}));
  await assert.rejects(previewGaizWithCustodyCandidate(bad,opts(provider)));
  assert.equal(releases,0);
});

test('wrong recipient DEK and invalid custody output never permit import',async()=>{
  await assert.rejects(previewGaizWithCustodyCandidate(bytes,opts({
    releaseSyntheticDek:async()=>Buffer.alloc(32,0),
  })));
  await assert.rejects(previewGaizWithCustodyCandidate(bytes,opts({
    releaseSyntheticDek:async()=>Buffer.alloc(16,0),
  })));
});
