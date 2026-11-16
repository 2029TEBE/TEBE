import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { createGaizTrustPolicy } from './gaiz-trust.mjs';

const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
  x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const issuer=generateKeyPairSync('ed25519');
const other=generateKeyPairSync('ed25519');
function artifact() {
  const manifest={artifactId:'synthetic',tenantScope:'tenant-a',version:1};
  const doc={manifest,nonce:randomBytes(12).toString('base64url'),
    ciphertext:randomBytes(3).toString('base64url'),tag:randomBytes(16).toString('base64url')};
  doc.signature=sign(null,Buffer.from('GAIZ1\n'+canonical(doc)),issuer.privateKey).toString('base64url');
  return Buffer.from('GAIZ1\n'+JSON.stringify(doc));
}
const record=(publicKey=issuer.publicKey,overrides={})=>({
  keyId:'to-synthetic-1',publicKey:publicKey.export({format:'pem',type:'spki'}),
  notBefore:0,notAfter:4102444800000,revoked:false,...overrides,
});
test('trusted issuer verifies under active independent policy',()=>{
  const policy=createGaizTrustPolicy([record()]);
  const result=policy.verify(artifact(),{keyId:'to-synthetic-1',expectedTenantScope:'tenant-a',now:100});
  assert.equal(result.verified,true);
  assert.equal(result.importAllowed,false);
  assert.deepEqual(policy.keyIds(),['to-synthetic-1']);
});
test('unknown, revoked, expired and tenant-foreign issuers denied',()=>{
  const bytes=artifact();
  for (const overrides of [{revoked:true},{notAfter:99},{notBefore:101}]) {
    const policy=createGaizTrustPolicy([record(issuer.publicKey,overrides)]);
    assert.throws(()=>policy.verify(bytes,{keyId:'to-synthetic-1',expectedTenantScope:'tenant-a',now:100}));
  }
  const policy=createGaizTrustPolicy([record()]);
  assert.throws(()=>policy.verify(bytes,{keyId:'unknown',expectedTenantScope:'tenant-a',now:100}));
  assert.throws(()=>policy.verify(bytes,{keyId:'to-synthetic-1',expectedTenantScope:'tenant-b',now:100}));
  assert.throws(()=>createGaizTrustPolicy([record(),record()]));
  assert.throws(()=>createGaizTrustPolicy([record(other.publicKey)]).verify(bytes,
    {keyId:'to-synthetic-1',expectedTenantScope:'tenant-a',now:100}));
});
