import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,createPublicKey} from 'node:crypto';
import {selectTrustedGaiz2Issuer,verifyGaiz2WithTrustBundle} from './gaiz2-trust-policy.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'fixtures','v2-fixed-001');
const pem=readFileSync(join(root,'issuer-public.pem'),'utf8');
const fixture=Buffer.from(readFileSync(join(root,'valid.gaiz.b64'),'utf8').trim(),'base64');
const spkiSha256=createHash('sha256').update(createPublicKey(pem).export({type:'spki',format:'der'})).digest('hex');
const entry={issuerId:'fixture-issuer',keyId:'fixture-key-1',publicKeyPem:pem,spkiSha256,allowedTenantScopes:['synthetic-tenant'],notBefore:'2026-01-01T00:00:00.000Z',notAfter:'2027-01-01T00:00:00.000Z',revoked:false};
const now=new Date('2026-11-16T00:00:00.000Z');
const bundle={version:1,issuers:[entry]};
test('independent trusted policy permits exact synthetic signature but denies authorization',()=>{
 assert.equal(selectTrustedGaiz2Issuer({bundle,issuerId:'fixture-issuer',tenantScope:'synthetic-tenant',now}).keyId,'fixture-key-1');
 const r=verifyGaiz2WithTrustBundle(fixture,{bundle,expectedIssuerId:'fixture-issuer',expectedTenantScope:'synthetic-tenant',now});
 assert.equal(r.signatureVerified,true);assert.equal(r.issuerKeyId,'fixture-key-1');
 assert.equal(r.authorizationGranted,false);assert.equal(r.importAllowed,false);
});
test('revocation, expiry, mismatched tenant and missing issuer fail closed',()=>{
 for(const issuers of [[{...entry,revoked:true}],[{...entry,notAfter:'2026-10-01T00:00:00.000Z'}],[],[{...entry,allowedTenantScopes:['another']}]]){
  assert.throws(()=>selectTrustedGaiz2Issuer({bundle:{version:1,issuers},issuerId:'fixture-issuer',tenantScope:'synthetic-tenant',now}));
 }
});
test('ambiguous overlapping rotation and substituted fingerprint fail closed',()=>{
 assert.throws(()=>selectTrustedGaiz2Issuer({bundle:{version:1,issuers:[entry,{...entry,keyId:'fixture-key-2'}]},issuerId:'fixture-issuer',tenantScope:'synthetic-tenant',now}));
 assert.throws(()=>selectTrustedGaiz2Issuer({bundle:{version:1,issuers:[{...entry,spkiSha256:'0'.repeat(64)}]},issuerId:'fixture-issuer',tenantScope:'synthetic-tenant',now}));
});
