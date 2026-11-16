import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,createCipheriv,sign} from 'node:crypto';
import {previewGaizCandidateSynthetic} from './gaiz-synthetic-preview.mjs';

const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?
  '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const issuer=generateKeyPairSync('ed25519');
const key=randomBytes(32);
const context={authenticated:true,entitled:true,workspaceMember:true,tenantId:'tenant-a',userId:'synthetic-user',capabilities:['read']};
function fixture(value={schemaVersion:1,title:'Synthetic governance',summary:'No customer data'}) {
  const manifest={tenantScope:'tenant-a',artifactId:'synthetic',version:1};
  const nonce=randomBytes(12);
  const encrypt=createCipheriv('aes-256-gcm',key,nonce);
  encrypt.setAAD(Buffer.from(canonical(manifest)));
  const ciphertext=Buffer.concat([encrypt.update(Buffer.from(JSON.stringify(value))),encrypt.final()]);
  const doc={manifest,nonce:nonce.toString('base64url'),tag:encrypt.getAuthTag().toString('base64url'),ciphertext:ciphertext.toString('base64url')};
  doc.signature=sign(null,Buffer.from('GAIZ1\n'+canonical(doc)),issuer.privateKey).toString('base64url');
  return Buffer.from('GAIZ1\n'+JSON.stringify(doc));
}
const args=()=>({trustedIssuerPublicKey:issuer.publicKey,expectedTenantScope:'tenant-a',dataEncryptionKey:key,context});
test('synthetic signed and AEAD-authenticated report preview is inert and not import permission',()=>{
  const r=previewGaizCandidateSynthetic(fixture(),args());
  assert.equal(r.preview.title,'Synthetic governance');
  assert.equal(r.authorizedToImport,false);
});
test('wrong DEK, wrong tenant, expired entitlement and forged signature are denied',()=>{
  assert.throws(()=>previewGaizCandidateSynthetic(fixture(),{...args(),dataEncryptionKey:randomBytes(32)}));
  assert.throws(()=>previewGaizCandidateSynthetic(fixture(),{...args(),expectedTenantScope:'tenant-b'}));
  assert.throws(()=>previewGaizCandidateSynthetic(fixture(),{...args(),context:{...context,entitled:false}}));
  assert.throws(()=>previewGaizCandidateSynthetic(fixture(),{...args(),trustedIssuerPublicKey:generateKeyPairSync('ed25519').publicKey}));
});
test('HTML-bearing content and unsupported fields never become preview',()=>{
  assert.throws(()=>previewGaizCandidateSynthetic(fixture({schemaVersion:1,title:'test',summary:'safe',html:'<script>alert(1)</script>'}),args()));
  assert.throws(()=>previewGaizCandidateSynthetic(fixture({schemaVersion:2,title:'test',summary:'safe'}),args()));
});
