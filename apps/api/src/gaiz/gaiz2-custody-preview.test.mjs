import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCipheriv,generateKeyPairSync,randomBytes,publicEncrypt,privateDecrypt,
  sign,constants,
} from 'node:crypto';
import {previewGaiz2CustodyCandidate} from './gaiz2-custody-preview.mjs';

const issuer=generateKeyPairSync('ed25519');
const recipient=generateKeyPairSync('rsa',{modulusLength:3072});
const another=generateKeyPairSync('rsa',{modulusLength:3072});
const b64=b=>Buffer.from(b).toString('base64url');
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
  x&&typeof x==='object'?
  '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':
  JSON.stringify(x);
const context=()=>({
  authenticated:true,entitled:true,workspaceMember:true,
  tenantId:'synthetic-tenant',userId:'synthetic-user',capabilities:['read'],
});
const opts=provider=>({
  context:context(),expectedTenantScope:'synthetic-tenant',
  expectedIssuerId:'synthetic-issuer',trustedIssuerPublicKey:issuer.publicKey,
  recipientKeyId:'synthetic-recipient',custodyProvider:provider,
});
const fixture=()=>{
  const manifest={
    version:2,schemaVersion:1,contentType:'application/vnd.orgaiz.report+json',
    artifactId:'synthetic-artifact',tenantScope:'synthetic-tenant',
    issuerId:'synthetic-issuer',createdAt:'2026-11-16T00:00:00.000Z',
  };
  const dek=randomBytes(32),nonce=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',dek,nonce);
  cipher.setAAD(Buffer.from(canonical(manifest)));
  const ciphertext=Buffer.concat([
    cipher.update(Buffer.from(canonical({title:'Synthetic report',findings:[]}))),
    cipher.final(),
  ]);
  const wrappedKey=publicEncrypt({
    key:recipient.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash:'sha256',
  },dek);
  dek.fill(0);
  const unsigned={
    manifest,nonce:b64(nonce),tag:b64(cipher.getAuthTag()),
    ciphertext:b64(ciphertext),
    recipients:[{keyId:'synthetic-recipient',wrappedKey:b64(wrappedKey)}],
  };
  const signature=b64(sign(null,Buffer.from('GAIZ2\n'+canonical(unsigned)),issuer.privateKey));
  return Buffer.from('GAIZ2\n'+canonical({...unsigned,signature}));
};
const provider=(onCall=()=>{})=>({
  unwrapSyntheticRecipientDek:async request=>{
    onCall(request);
    return privateDecrypt({
      key:recipient.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash:'sha256',
    },Buffer.from(request.wrappedKey,'base64url'));
  },
});

test('GAIZ2 custody returns title only with no DEK, import right, or raw report',async()=>{
  const prior=process.env.GAIZ_DEV_ONLY;
  const priorNode=process.env.NODE_ENV;
  try{
    process.env.GAIZ_DEV_ONLY='true';
    process.env.NODE_ENV='test';
    let releases=0;
    const result=await previewGaiz2CustodyCandidate(fixture(),opts(provider(r=>{
      releases++;
      assert.equal(r.purpose,'synthetic-preview-only');
      assert.equal(r.algorithm,'RSA-OAEP-SHA256');
      assert.equal(r.tenantId,'synthetic-tenant');
      assert.equal(Object.isFrozen(r),true);
    })));
    assert.equal(releases,1);
    assert.deepEqual(result.preview,{title:'Synthetic report'});
    assert.equal(result.importAllowed,false);
    assert.equal(result.authorizationGranted,false);
    assert.equal(result.syntheticCandidateOnly,true);
    assert.equal(Object.hasOwn(result,'report'),false);
    assert.equal(Object.hasOwn(result,'dek'),false);
  }finally{
    if(prior===undefined)delete process.env.GAIZ_DEV_ONLY;
    else process.env.GAIZ_DEV_ONLY=prior;
    if(priorNode===undefined)delete process.env.NODE_ENV;
    else process.env.NODE_ENV=priorNode;
  }
});
test('invalid scope and signature cannot trigger custody release',async()=>{
  const prior=process.env.GAIZ_DEV_ONLY,priorNode=process.env.NODE_ENV;
  process.env.GAIZ_DEV_ONLY='true';
  process.env.NODE_ENV='test';
  try{
    let releases=0;
    const guard=provider(()=>{releases++});
    const bytes=fixture();
    const changes=[
      {...opts(guard),expectedTenantScope:'attacker-tenant'},
      {...opts(guard),expectedIssuerId:'unknown-issuer'},
      {...opts(guard),recipientKeyId:'missing-recipient'},
      {...opts(guard),context:{...context(),entitled:false}},
      {...opts(guard),trustedIssuerPublicKey:generateKeyPairSync('ed25519').publicKey},
    ];
    for(const o of changes)await assert.rejects(previewGaiz2CustodyCandidate(bytes,o));
    const corrupted=Buffer.from(bytes);
    corrupted[corrupted.length-6]^=1;
    await assert.rejects(previewGaiz2CustodyCandidate(corrupted,opts(guard)));
    assert.equal(releases,0);
    await assert.rejects(previewGaiz2CustodyCandidate(bytes,opts({
      unwrapSyntheticRecipientDek:async()=>privateDecrypt({
        key:another.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash:'sha256',
      },Buffer.alloc(384)),
    })));
  }finally{
    if(prior===undefined)delete process.env.GAIZ_DEV_ONLY;
    else process.env.GAIZ_DEV_ONLY=prior;
    if(priorNode===undefined)delete process.env.NODE_ENV;
    else process.env.NODE_ENV=priorNode;
  }
});
