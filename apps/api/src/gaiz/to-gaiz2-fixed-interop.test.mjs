import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyGaiz2ForPreview} from './gaiz2-verifier.mjs';

const folder=new URL('./fixtures/to-gaiz2-fixed-001/',import.meta.url);
const expected=JSON.parse(readFileSync(new URL('expected.json',folder),'utf8'));
const key=readFileSync(new URL('issuer-public.pem',folder),'utf8');
const artifact=Buffer.from(readFileSync(new URL('valid.gaiz.b64',folder),'utf8').trim(),'base64');
const policy={trustedIssuerPublicKey:key,expectedIssuerId:expected.manifest.issuerId,expectedTenantScope:expected.manifest.tenantScope};
test('independently produced fixed TO artifact verifies but grants no authority',()=>{
 assert.equal(artifact.byteLength,expected.size);
 assert.equal(createHash('sha256').update(artifact).digest('hex'),expected.sha256);
 const receipt=verifyGaiz2ForPreview(artifact,policy);
 assert.equal(receipt.verified,true);
 assert.equal(receipt.authorizationGranted,false);
 assert.equal(receipt.importAllowed,false);
 assert.equal(receipt.sha256,expected.sha256);
});
test('fixed TO artifact rejects wrong issuer, tenant, trusted key and tampering',()=>{
 assert.throws(()=>verifyGaiz2ForPreview(artifact,{...policy,expectedIssuerId:'wrong-issuer'}));
 assert.throws(()=>verifyGaiz2ForPreview(artifact,{...policy,expectedTenantScope:'wrong-tenant'}));
 assert.throws(()=>verifyGaiz2ForPreview(artifact,{...policy,trustedIssuerPublicKey:''}));
 const raw=artifact.toString('utf8');
 assert.throws(()=>verifyGaiz2ForPreview(Buffer.from(raw.replace(expected.manifest.artifactId,'altered-artifact')),policy));
 assert.throws(()=>verifyGaiz2ForPreview(Buffer.concat([artifact,Buffer.from(' ')]),policy));
});
