/**
 * Cross-repository GAIZ2 fixed-vector conformance.
 * Fixture bytes and issuer public key are copied verbatim from TO PR #33,
 * gaiz/fixtures/v2-fixed-001, a synthetic non-customer producer fixture.
 * No private key is distributed and no decryption or import is performed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,generateKeyPairSync} from 'node:crypto';
import {verifyGaiz2ForPreview,verifyGaiz2ForQuarantine,verifyGaiz2RecipientForCustody} from './gaiz2-verifier.mjs';

const root=new URL('./fixtures/to-gaiz2-fixed-001/',import.meta.url);
const fixture=readFileSync(new URL('valid.gaiz.b64',root),'utf8').trim();
const envelope=Buffer.from(fixture,'base64');
const publicKey=readFileSync(new URL('issuer-public.pem',root),'utf8');
const expected=JSON.parse(readFileSync(new URL('expected.json',root),'utf8'));
const policy=Object.freeze({
  trustedIssuerPublicKey:publicKey,
  expectedIssuerId:expected.manifest.issuerId,
  expectedTenantScope:expected.manifest.tenantScope,
});
const verify=()=>verifyGaiz2ForQuarantine(envelope,policy);

test('pinned TO producer vector is byte-identical, Ed25519-signed, and metadata-only',()=>{
  assert.equal(envelope.length,expected.size);
  assert.equal(createHash('sha256').update(envelope).digest('hex'),expected.sha256);
  assert.equal(envelope.subarray(0,6).toString(),'GAIZ2\n');
  assert.equal(envelope.toString('base64'),fixture);
  const receipt=verify();
  assert.equal(receipt.format,'GAIZ2');
  assert.equal(receipt.artifactId,expected.manifest.artifactId);
  assert.equal(receipt.tenantScope,expected.manifest.tenantScope);
  assert.equal(receipt.issuerId,expected.manifest.issuerId);
  assert.equal(receipt.envelopeSha256,expected.sha256);
  assert.equal(receipt.signatureVerified,expected.expected.signatureVerified);
  assert.equal(receipt.authorizationGranted,expected.expected.authorizationGranted);
  assert.equal(receipt.importAllowed,expected.expected.importAllowed);
  assert.equal(Object.isFrozen(receipt),true);
});

test('verified TO recipient descriptor is encrypted data, never an import grant',()=>{
  const result=verifyGaiz2RecipientForCustody(envelope,{
    ...policy,recipientKeyId:'fixture-recipient',
  });
  assert.equal(result.envelopeSha256,expected.sha256);
  assert.equal(result.recipientKeyId,'fixture-recipient');
  assert.ok(typeof result.wrappedKey==='string'&&result.wrappedKey.length>300);
  assert.equal(result.authorizationGranted,false);
  assert.equal(result.importAllowed,false);
  assert.equal(Object.isFrozen(result),true);
  assert.equal(result.manifest.artifactId,expected.manifest.artifactId);
  assert.equal(Object.hasOwn(result,'dek'),false);
  assert.equal(Object.hasOwn(result,'plaintext'),false);
});

test('independent fixture rejects unauthorized tenant, issuer and trust anchor',()=>{
  assert.throws(()=>verifyGaiz2ForQuarantine(envelope,{
    ...policy,expectedTenantScope:'different-tenant',
  }));
  assert.throws(()=>verifyGaiz2ForQuarantine(envelope,{
    ...policy,expectedIssuerId:'different-issuer',
  }));
  assert.throws(()=>verifyGaiz2ForQuarantine(envelope,{
    ...policy,trustedIssuerPublicKey:generateKeyPairSync('ed25519').publicKey,
  }));
  assert.throws(()=>verifyGaiz2RecipientForCustody(envelope,{
    ...policy,recipientKeyId:'nonexistent-recipient',
  }));
});

test('fixed producer vector rejects altered bytes, bogus encoding and missing GAIZ2 header',()=>{
  const altered=Buffer.from(envelope);
  const index=altered.indexOf(Buffer.from('synthetic-fixed-01'));
  assert.ok(index>6);
  altered[index]^=1;
  assert.throws(()=>verifyGaiz2ForQuarantine(altered,policy));
  assert.throws(()=>verifyGaiz2ForQuarantine(Buffer.concat([
    envelope,Buffer.from(' '),
  ]),policy));
  assert.throws(()=>verifyGaiz2ForQuarantine(Buffer.concat([
    Buffer.from('GAIZ1\n'),envelope.subarray(6),
  ]),policy));
});

test('independent GAIZ2 preview and enterprise quarantine profiles agree on TO signed fixture',()=>{
  const preview=verifyGaiz2ForPreview(envelope,policy);
  const enterprise=verifyGaiz2ForQuarantine(envelope,policy);
  assert.equal(preview.verified,true);
  assert.equal(enterprise.signatureVerified,true);
  assert.equal(preview.sha256,enterprise.envelopeSha256);
  assert.equal(preview.sha256,expected.sha256);
  for(const key of ['format','artifactId','issuerId','tenantScope','authorizationGranted','importAllowed'])
    assert.equal(preview[key],enterprise[key]);
  assert.equal(preview.authorizationGranted,false);
  assert.equal(enterprise.importAllowed,false);
  const tampered=Buffer.from(envelope);
  tampered[tampered.length-10]^=1;
  assert.throws(()=>verifyGaiz2ForPreview(tampered,policy));
  assert.throws(()=>verifyGaiz2ForQuarantine(tampered,policy));
});
