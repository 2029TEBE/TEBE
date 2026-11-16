import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv,generateKeyPairSync,randomBytes,publicEncrypt,
  sign,constants} from 'node:crypto';
import {verifyGaiz2ForQuarantine} from './gaiz2-verifier.mjs';
const issuer=generateKeyPairSync('ed25519');
const recipient=generateKeyPairSync('rsa',{modulusLength:3072});
const context={expectedIssuerId:'synthetic-issuer',expectedTenantScope:'tenant-a',
  trustedIssuerPublicKey:issuer.publicKey};
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
  x&&typeof x==='object'?
  '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':
  JSON.stringify(x);
const b64=x=>Buffer.from(x).toString('base64url');
const magic='GAIZ2\n';
const envelope=(recipientKey=recipient.publicKey)=>{
  const dek=randomBytes(32),nonce=randomBytes(12);
  const manifest={version:2,schemaVersion:1,contentType:'application/vnd.orgaiz.report+json',
    artifactId:'synthetic-asset',issuerId:'synthetic-issuer',
    tenantScope:'tenant-a',createdAt:'2026-11-16T00:00:00.000Z'};
  const cipher=createCipheriv('aes-256-gcm',dek,nonce);
  cipher.setAAD(Buffer.from(canonical(manifest)));
  const ciphertext=Buffer.concat([cipher.update(Buffer.from(canonical({
    title:'Synthetic report',summary:'No customer data',
  }))),cipher.final()]);
  const recipients=[{keyId:'recipient-one',wrappedKey:b64(publicEncrypt({
    key:recipientKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256',
  },dek))}];
  const unsigned={manifest,nonce:b64(nonce),tag:b64(cipher.getAuthTag()),
    ciphertext:b64(ciphertext),recipients};
  dek.fill(0);
  const signature=b64(sign(null,Buffer.from(magic+canonical(unsigned)),issuer.privateKey));
  return Buffer.from(magic+canonical({...unsigned,signature}));
};
test('independent synthetically signed GAIZ2 envelope remains metadata-only',()=>{
  const file=envelope();
  const receipt=verifyGaiz2ForQuarantine(file,context);
  assert.equal(receipt.format,'GAIZ2');
  assert.equal(receipt.signatureVerified,true);
  assert.equal(receipt.authorizationGranted,false);
  assert.equal(receipt.importAllowed,false);
  assert.equal(receipt.recipientCount,1);
  assert.equal(Object.isFrozen(receipt),true);
});
test('wrong tenant, issuer, signature and tampered recipients fail closed',()=>{
  const file=envelope();
  assert.throws(()=>verifyGaiz2ForQuarantine(file,{
    ...context,expectedTenantScope:'tenant-b',
  }));
  assert.throws(()=>verifyGaiz2ForQuarantine(file,{
    ...context,expectedIssuerId:'different-issuer',
  }));
  assert.throws(()=>verifyGaiz2ForQuarantine(file,{
    ...context,trustedIssuerPublicKey:generateKeyPairSync('ed25519').publicKey,
  }));
  const obj=JSON.parse(file.toString().slice(magic.length));
  obj.recipients[0].keyId='another-recipient';
  assert.throws(()=>verifyGaiz2ForQuarantine(
    Buffer.from(magic+canonical(obj)),context));
});
test('noncanonical, duplicate keys, unsupported GAIZ1 and unsigned replay inputs denied',()=>{
  const file=envelope();
  assert.throws(()=>verifyGaiz2ForQuarantine(Buffer.from('GAIZ1\n{}'),context));
  assert.throws(()=>verifyGaiz2ForQuarantine(Buffer.concat([file,Buffer.from(' ')]),context));
  const text=file.toString();
  assert.throws(()=>verifyGaiz2ForQuarantine(Buffer.from(text.replace(
    '"version":2','"version":2,"version":2')),context));
  const doc=JSON.parse(text.slice(magic.length));
  doc.recipients.push(doc.recipients[0]);
  assert.throws(()=>verifyGaiz2ForQuarantine(
    Buffer.from(magic+canonical(doc)),context));
});

test('TO GAIZ2 rejects otherwise valid signed RSA-2048 recipient envelopes',()=>{
  const weakRecipient=generateKeyPairSync('rsa',{modulusLength:2048});
  assert.throws(()=>verifyGaiz2ForQuarantine(envelope(weakRecipient.publicKey),context));
});
