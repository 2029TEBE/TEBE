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
  assert.throws(()=>verifyGaizForPreview(bytes,{trustedIssuerPublicKey:publicKey,expectedTenantScope:'other'}),/Tenant mismatch/);
  assert.throws(()=>verifyGaizForPreview(Buffer.from(bytes.toString().replace('synthetic','tampered')), {trustedIssuerPublicKey:publicKey,expectedTenantScope:'test-tenant'}));
});
