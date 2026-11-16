// Test-only independent GAIZ2 signature interoperability. This is NOT an API adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,verify,createPublicKey} from 'node:crypto';
import {verifyGaizForPreview} from './gaiz-verifier.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'fixtures','v2-fixed-001');
const fixture=Buffer.from(readFileSync(join(root,'valid.gaiz.b64'),'utf8').trim(),'base64');
const expected=JSON.parse(readFileSync(join(root,'expected.json'),'utf8'));
const trustedIssuerPublicKey=readFileSync(join(root,'issuer-public.pem'),'utf8');
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
function verifyFixture(bytes,{publicKey=trustedIssuerPublicKey,issuerId='fixture-issuer',tenantScope='synthetic-tenant'}={}){
 assert.ok(bytes.length>6&&bytes.length<=8*1024*1024&&bytes.subarray(0,6).equals(Buffer.from('GAIZ2\n')));
 const body=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(6));
 const doc=JSON.parse(body);
 assert.equal(canonical(doc),body,'canonical bytes required');
 assert.deepEqual(Object.keys(doc).sort(),['ciphertext','manifest','nonce','recipients','signature','tag']);
 assert.equal(doc.manifest.version,2);
 assert.equal(doc.manifest.issuerId,issuerId);
 assert.equal(doc.manifest.tenantScope,tenantScope);
 const signature=Buffer.from(doc.signature,'base64url');
 assert.equal(signature.length,64);
 assert.equal(signature.toString('base64url'),doc.signature);
 const unsigned={ciphertext:doc.ciphertext,manifest:doc.manifest,nonce:doc.nonce,recipients:doc.recipients,tag:doc.tag};
 assert.equal(verify(null,Buffer.from('GAIZ2\n'+canonical(unsigned)),createPublicKey(publicKey),signature),true,'untrusted signature');
 return Object.freeze({signatureVerified:true,authorizationGranted:false,importAllowed:false});
}
test('TEBE verifies exact independent TO GAIZ2 fixture without authorizing import',()=>{
 assert.equal(fixture.length,expected.size);
 assert.equal(createHash('sha256').update(fixture).digest('hex'),expected.sha256);
 const receipt=verifyFixture(fixture);
 assert.deepEqual(receipt,expected.expected);
 // Existing GAIZ1 verifier must fail closed on GAIZ2, not re-interpret it.
 assert.throws(()=>verifyGaizForPreview(fixture,{trustedIssuerPublicKey,expectedTenantScope:'synthetic-tenant'}));
});
test('TEBE test-only verifier denies tampering, wrong issuer/tenant/key and unknown header',()=>{
 assert.throws(()=>verifyFixture(fixture,{issuerId:'unexpected'}));
 assert.throws(()=>verifyFixture(fixture,{tenantScope:'unexpected'}));
 assert.throws(()=>verifyFixture(fixture,{publicKey:''}));
 const tampered=Buffer.from(fixture);
 tampered[tampered.indexOf(Buffer.from('synthetic-fixed-01'))+1]^=1;
 assert.throws(()=>verifyFixture(tampered));
 const wrongHeader=Buffer.from(fixture);wrongHeader[4]=49;
 assert.throws(()=>verifyFixture(wrongHeader));
});
