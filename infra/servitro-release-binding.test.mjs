import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkReleaseBinding} from './servitro-release-binding.mjs';
const SHA='a'.repeat(40), DIGEST='sha256:'+'b'.repeat(64), now=new Date('2026-11-03T12:00:00Z');
const kinds=['image-attestation','https-health','nonprod-isolation','encrypted-backup','isolated-restore','alert-delivery','rollback-drill','independent-review'];
function fixture(){
 const bytes=Buffer.from('synthetic receipt: not provider proof');
 const hash=createHash('sha256').update(bytes).digest('hex');
 const manifest={schemaVersion:1,releaseSha:SHA,artifacts:kinds.map((category,i)=>({category,path:'receipt-'+i+'.txt',sha256:hash,releaseSha:SHA}))};
 const metadata={releaseSha:SHA,imageDigest:DIGEST,environment:'isolated-nonproduction',evidence:kinds.map(kind=>({kind,releaseSha:SHA,imageDigest:DIGEST,environment:'isolated-nonproduction',observedAt:'2026-11-03T11:50:00Z',result:'pass'}))};
 return {manifest,metadata,load:()=>bytes,expectedSha:SHA,expectedImageDigest:DIGEST,now};
}
test('synthetic consistent inputs pass offline but never authorize deployment',()=>{
 const r=checkReleaseBinding(fixture());assert.equal(r.accepted,true);assert.equal(r.operationallyVerified,false);assert.equal(r.deploymentAuthorized,false);
});
test('reject expected release SHA mismatch',()=>{
 const f=fixture();f.expectedSha='c'.repeat(40);assert.equal(checkReleaseBinding(f).accepted,false);
});
test('reject metadata image digest mismatch',()=>{
 const f=fixture();f.metadata.imageDigest='sha256:'+'c'.repeat(64);assert.equal(checkReleaseBinding(f).accepted,false);
});
test('reject tampered local evidence',()=>{
 const f=fixture();f.load=()=>Buffer.from('tampered');const r=checkReleaseBinding(f);assert.ok(r.errors.includes('integrity-rejected'));
});
test('reject stale HTTPS receipt',()=>{
 const f=fixture();f.metadata.evidence.find(e=>e.kind==='https-health').observedAt='2026-11-02T11:00:00Z';assert.ok(checkReleaseBinding(f).errors.includes('freshness-rejected'));
});
test('fail closed on malformed input or throwing loader',()=>{
 assert.equal(checkReleaseBinding().accepted,false);
 const f=fixture();f.load=()=>{throw Error('private');};assert.equal(checkReleaseBinding(f).accepted,false);
});
