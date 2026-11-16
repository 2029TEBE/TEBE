// Source-only integration regression. No app route, DB, payments, credentials or keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import {verifyGaiz2ForQuarantine} from './gaiz2-enterprise-verifier.mjs';
import {planSyntheticGaizGovernanceDraft} from './gaiz-draft-mapping.mjs';
import {requireGaizOperation,transitionGaizImport,gaizReplayIdentity} from './gaiz-workflow.mjs';

const tenantId='00000000-0000-4000-8000-000000000001';
const otherTenant='00000000-0000-4000-8000-000000000009';
const submittedBy='00000000-0000-4000-8000-000000000002';
const reviewer='00000000-0000-4000-8000-000000000003';
const evidence={
  tenantId,workspaceId:tenantId,
  quarantineId:'00000000-0000-4000-8000-000000000004',
  artifactId:'synthetic',issuerKeyId:'issuer-a',
  envelopeSha256:'a'.repeat(64),
  signatureValid:true,aeadValid:true,schemaMapped:true,entitled:true,
};
const content={schemaVersion:1,title:'Synthetic governance',summary:'No customer information'};
const actor={tenantId,userId:reviewer,authenticated:true,entitled:true,
  workspaceMember:true,capabilities:['read','pmoa_approve','pmoa_manage_projects']};
test('mapped draft is non-executable even when policy grants read and approval capability',()=>{
  const draft=planSyntheticGaizGovernanceDraft(content,evidence);
  assert.equal(requireGaizOperation(actor,'preview',tenantId),true);
  assert.equal(draft.executable,false);
  assert.equal(draft.requiresHumanApproval,true);
  assert.equal(Object.hasOwn(draft,'approvedBy'),false);
  assert.equal(Object.hasOwn(draft,'authorizationGranted'),false);
  assert.deepEqual(Object.keys(draft.fields).sort(),['summary','title']);
});
test('a draft proposal never bypasses distinct-person approval, revisions or tenant scope',()=>{
  const job={tenantId,artifactId:'synthetic',id:'synthetic-work-item',
    requestedBy:submittedBy,state:'pending_approval',revision:0};
  const request={nextState:'approved',expectedRevision:0,
    signatureValid:true,aeadValid:true,mappingValidated:true,entitled:true};
  const next=transitionGaizImport(job,request,actor);
  assert.equal(next.state,'approved');
  assert.equal(next.revision,1);
  assert.equal(job.state,'pending_approval');
  assert.throws(()=>transitionGaizImport(job,request,{...actor,userId:submittedBy}));
  assert.throws(()=>transitionGaizImport(job,{...request,expectedRevision:1},actor));
  assert.throws(()=>transitionGaizImport(job,request,{...actor,tenantId:otherTenant}));
  assert.throws(()=>planSyntheticGaizGovernanceDraft(content,{...evidence,workspaceId:otherTenant}));
  assert.notEqual(
    gaizReplayIdentity({tenantId,issuerKeyId:'issuer-a',artifactId:'synthetic'}),
    gaizReplayIdentity({tenantId:otherTenant,issuerKeyId:'issuer-a',artifactId:'synthetic'})
  );
});

test('valid GAIZ2 signature remains metadata only and never supplies mapping authorization',()=>{
  const {generateKeyPairSync,randomBytes,createCipheriv,publicEncrypt,sign,constants}=crypto;
  const issuer=generateKeyPairSync('ed25519');
  const recipient=generateKeyPairSync('rsa',{modulusLength:3072});
  const manifest={
    artifactId:'synthetic',contentType:'application/vnd.orgaiz.report+json',
    createdAt:'2026-11-16T00:00:00.000Z',issuerId:'issuer-a',
    schemaVersion:1,tenantScope:tenantId,version:2,
  };
  const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
    x&&typeof x==='object'?
      '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':
      JSON.stringify(x);
  const base64=x=>Buffer.from(x).toString('base64url');
  const dek=randomBytes(32), nonce=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',dek,nonce);
  cipher.setAAD(Buffer.from(canonical(manifest)));
  const ciphertext=Buffer.concat([cipher.update(Buffer.from(canonical(content))),cipher.final()]);
  const unsigned={
    manifest,nonce:base64(nonce),ciphertext:base64(ciphertext),
    tag:base64(cipher.getAuthTag()),
    recipients:[{keyId:'recipient-a',wrappedKey:base64(publicEncrypt({
      key:recipient.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256',
    },dek))}],
  };
  dek.fill(0);
  const signature=base64(sign(null,Buffer.from('GAIZ2\\n'+canonical(unsigned)),issuer.privateKey));
  const envelope=Buffer.from('GAIZ2\\n'+canonical({...unsigned,signature}));
  const receipt=verifyGaiz2ForQuarantine(envelope,{
    trustedIssuerPublicKey:issuer.publicKey,expectedIssuerId:'issuer-a',
    expectedTenantScope:tenantId,
  });
  assert.equal(receipt.signatureVerified,true);
  assert.equal(receipt.authorizationGranted,false);
  assert.equal(receipt.importAllowed,false);
  assert.throws(()=>planSyntheticGaizGovernanceDraft(content,{
    ...evidence,signatureValid:receipt.signatureVerified,
    aeadValid:receipt.importAllowed,
  }));
  assert.throws(()=>transitionGaizImport({
    tenantId,artifactId:'synthetic',id:'job',requestedBy:submittedBy,
    state:'pending_approval',revision:0,
  },{
    nextState:'approved',expectedRevision:0,
    signatureValid:receipt.signatureVerified,aeadValid:receipt.importAllowed,
    mappingValidated:true,entitled:true,
  },actor));
  assert.throws(()=>verifyGaiz2ForQuarantine(envelope,{
    trustedIssuerPublicKey:issuer.publicKey,expectedIssuerId:'issuer-a',
    expectedTenantScope:otherTenant,
  }));
});
