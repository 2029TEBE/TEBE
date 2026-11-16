import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,createCipheriv,sign} from 'node:crypto';
import {verifyGaizForPreview} from './gaiz-verifier.mjs';
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
test('TO-format signed AES-GCM envelope interoperates with TEBE preview adapter',()=>{
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const key=randomBytes(32), nonce=randomBytes(12), manifest={tenantScope:'test-tenant',artifactId:'synthetic',version:1};
  const cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(Buffer.from(canonical(manifest)));
  const ciphertext=Buffer.concat([cipher.update(Buffer.from('{"synthetic":true}')),cipher.final()]);
  const doc={manifest,nonce:nonce.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),ciphertext:ciphertext.toString('base64url')};
  doc.signature=sign(null,Buffer.from('GAIZ1\n'+canonical(doc)),privateKey).toString('base64url');
  const bytes=Buffer.from('GAIZ1\n'+JSON.stringify(doc));
  assert.equal(verifyGaizForPreview(bytes,{trustedIssuerPublicKey:publicKey,expectedTenantScope:'test-tenant'}).importAllowed,false);
  assert.throws(()=>verifyGaizForPreview(bytes,{trustedIssuerPublicKey:publicKey,expectedTenantScope:'other'}));
  assert.throws(()=>verifyGaizForPreview(Buffer.from(bytes.toString().replace('synthetic','tampered')), {trustedIssuerPublicKey:publicKey,expectedTenantScope:'test-tenant'}));
});


function makeFixture() {
  const key=randomBytes(32), nonce=randomBytes(12), manifest={tenantScope:'test-tenant',artifactId:'synthetic',version:1};
  const cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(Buffer.from(canonical(manifest)));
  const ciphertext=Buffer.concat([cipher.update(Buffer.from('{"synthetic":true}')),cipher.final()]);
  const doc={manifest,nonce:nonce.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),ciphertext:ciphertext.toString('base64url')};
  doc.signature=sign(null,Buffer.from('GAIZ1\n'+canonical(doc)),testIssuer.privateKey).toString('base64url');
  return Buffer.from('GAIZ1\n'+JSON.stringify(doc));
}
const testIssuer=generateKeyPairSync('ed25519');
const policy=()=>({trustedIssuerPublicKey:testIssuer.publicKey,expectedTenantScope:'test-tenant'});


test('rejects duplicate manifest keys, invalid UTF-8, and unknown fields',()=>{
  const bytes=makeFixture();
  assert.throws(()=>verifyGaizForPreview(Buffer.from(bytes.toString().replace('"version":1','"version":1,"version":1')),policy()));
  assert.throws(()=>verifyGaizForPreview(Buffer.concat([bytes,Buffer.from([0xff])]),policy()));
  assert.throws(()=>verifyGaizForPreview(Buffer.from(bytes.toString().replace('"tag":','"extra":true,"tag":')),policy()));
});
test('rejects oversized, unsupported version, noncanonical encoding and wrong issuer',()=>{
  const bytes=makeFixture();
  assert.throws(()=>verifyGaizForPreview(Buffer.concat([Buffer.from('GAIZ1\n'),Buffer.alloc(8*1024*1024)]),policy()));
  assert.throws(()=>verifyGaizForPreview(Buffer.from(bytes.toString().replace('"version":1','"version":2')),policy()));
  assert.throws(()=>verifyGaizForPreview(Buffer.from(bytes.toString().replace('"nonce":"','"nonce":"=')),policy()));
  const other=generateKeyPairSync('ed25519').publicKey;
  assert.throws(()=>verifyGaizForPreview(bytes,{trustedIssuerPublicKey:other,expectedTenantScope:'test-tenant'}));
});

test('fail closed for null manifest, absent trust policy, wrong key algorithm and unsafe number',()=>{
 const bytes=makeFixture();
 assert.throws(()=>verifyGaizForPreview(bytes));
 assert.throws(()=>verifyGaizForPreview(Buffer.from(bytes.toString().replace(/"manifest":\{[^}]+\}/,'"manifest":null')),policy()));
 const rsa=generateKeyPairSync('rsa',{modulusLength:2048}).publicKey;
 assert.throws(()=>verifyGaizForPreview(bytes,{trustedIssuerPublicKey:rsa,expectedTenantScope:'test-tenant'}));
 assert.throws(()=>verifyGaizForPreview(Buffer.from(bytes.toString().replace('"version":1','"version":1e999')),policy()));
});
