import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,createCipheriv,publicEncrypt,constants,sign} from 'node:crypto';
import {verifyGaiz2ForPreview} from './gaiz2-verifier.mjs';
// Synthetic TO GAIZ2 wire-compatible fixture producer for isolated TEBE CI.
// Must be replaced/supplemented by byte-identical pinned TO-produced artifacts.
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const issuer=generateKeyPairSync('ed25519'),recipient=generateKeyPairSync('rsa',{modulusLength:3072});
const m={artifactId:'synthetic-test-01',contentType:'application/vnd.orgaiz.report+json',createdAt:'2026-11-16T00:00:00.000Z',issuerId:'test-issuer',schemaVersion:1,tenantScope:'synthetic-tenant',version:2};
const fixture=()=>{
 const nonce=randomBytes(12),dek=randomBytes(32),cipher=createCipheriv('aes-256-gcm',dek,nonce);
 cipher.setAAD(Buffer.from(canonical(m)));
 const ciphertext=Buffer.concat([cipher.update(Buffer.from(canonical({title:'Synthetic governance report',summary:'مرحبا — demo 😃'}))),cipher.final()]);
 const unsigned={ciphertext:ciphertext.toString('base64url'),manifest:m,nonce:nonce.toString('base64url'),recipients:[{keyId:'test-recipient',wrappedKey:publicEncrypt({key:recipient.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},dek).toString('base64url')}],tag:cipher.getAuthTag().toString('base64url')};
 dek.fill(0);
 const signature=sign(null,Buffer.from('GAIZ2\n'+canonical(unsigned)),issuer.privateKey).toString('base64url');
 return Buffer.from('GAIZ2\n'+canonical({...unsigned,signature}));
};
const opts={trustedIssuerPublicKey:issuer.publicKey,expectedIssuerId:'test-issuer',expectedTenantScope:'synthetic-tenant'};
test('GAIZ2 wire-compatible signed fixture verified with no import permission',()=>{
 const result=verifyGaiz2ForPreview(fixture(),opts);
 assert.equal(result.verified,true);
 assert.equal(result.format,'GAIZ2');
 assert.equal(result.authorizationGranted,false);
 assert.equal(result.importAllowed,false);
 assert.match(result.sha256,/^[a-f0-9]{64}$/);
});
test('invalid tenant, issuer and trusted key denied',()=>{
 const bytes=fixture();
 assert.throws(()=>verifyGaiz2ForPreview(bytes,{...opts,expectedTenantScope:'different'}),/Tenant denied/);
 assert.throws(()=>verifyGaiz2ForPreview(bytes,{...opts,expectedIssuerId:'different'}),/Issuer denied/);
 assert.throws(()=>verifyGaiz2ForPreview(bytes,{...opts,trustedIssuerPublicKey:generateKeyPairSync('ed25519').publicKey}),/signature/);
 assert.throws(()=>verifyGaiz2ForPreview(bytes,{}),/policy/);
});
test('GAIZ1 downgrade, tampered data, malformed UTF-8 and parser ambiguity denied',()=>{
 const bytes=fixture(),text=bytes.toString('utf8');
 assert.throws(()=>verifyGaiz2ForPreview(Buffer.from('GAIZ1\n'+text.slice(6)),opts),/header/);
 const changed=text.replace('synthetic-test-01','synthetic-test-02');
 assert.throws(()=>verifyGaiz2ForPreview(Buffer.from(changed),opts),/signature/);
 assert.throws(()=>verifyGaiz2ForPreview(Buffer.concat([Buffer.from('GAIZ2\n'),Buffer.from([255])]),opts));
 assert.throws(()=>verifyGaiz2ForPreview(Buffer.from(text+' '),opts),/Noncanonical/);
 assert.throws(()=>verifyGaiz2ForPreview(Buffer.from(text.replace('"version":2','"version":2,"version":2')),opts));
 assert.throws(()=>verifyGaiz2ForPreview(Buffer.from(text.replace('"version":2','"version":2.0')),opts));
 assert.throws(()=>verifyGaiz2ForPreview(Buffer.alloc(8*1024*1024+1),opts));
});
