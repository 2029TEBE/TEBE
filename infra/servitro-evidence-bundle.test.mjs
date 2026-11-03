import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyBundle, verifyFromDisk} from './servitro-evidence-bundle.mjs';
import {mkdtempSync,writeFileSync,symlinkSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const cats=['image-attestation','https-health','nonprod-isolation','encrypted-backup','isolated-restore','alert-delivery','rollback-drill','independent-review'];
const sha='a'.repeat(40), bytes=Buffer.from('synthetic evidence only');
const digest=createHash('sha256').update(bytes).digest('hex');
const fixture=()=>({schemaVersion:1,releaseSha:sha,artifacts:cats.map(category=>({category,path:category+'.json',sha256:digest,releaseSha:sha}))});
const check=m=>verifyBundle(m,()=>bytes);
test('valid synthetic bytes have integrity, never operational acceptance',()=>{const r=check(fixture());assert.equal(r.accepted,true);assert.equal(r.operationallyVerified,false);assert.equal(r.deploymentAuthorized,false)});
test('missing category fails closed',()=>{const m=fixture();m.artifacts.pop();assert.equal(check(m).accepted,false)});
test('duplicate category fails closed',()=>{const m=fixture();m.artifacts[1].category=m.artifacts[0].category;assert.equal(check(m).accepted,false)});
test('different release SHA rejected',()=>{const m=fixture();m.artifacts[0].releaseSha='b'.repeat(40);assert.equal(check(m).accepted,false)});
test('tampered evidence bytes rejected',()=>{const r=verifyBundle(fixture(),()=>Buffer.from('tampered'));assert.ok(r.errors.includes('digest-mismatch'))});
test('path traversal rejected',()=>{const m=fixture();m.artifacts[0].path='../secret';assert.ok(check(m).errors.includes('path'))});
test('absolute path rejected',()=>{const m=fixture();m.artifacts[0].path='/etc/passwd';assert.equal(check(m).accepted,false)});
test('unknown fields rejected',()=>{const m=fixture();m.credentials='do-not-print';assert.ok(check(m).errors.includes('unknown-field'));assert.doesNotMatch(JSON.stringify(check(m)),/do-not-print/)});
test('missing file rejected',()=>{const r=verifyBundle(fixture(),()=>{throw Error('secret token')});assert.ok(r.errors.includes('missing-artifact'));assert.doesNotMatch(JSON.stringify(r),/secret token/)});
test('oversized evidence rejected',()=>{const r=verifyBundle(fixture(),()=>Buffer.alloc(1024*1024+1));assert.ok(r.errors.includes('artifact-size'))});


test('Q87 disk verifier rejects a symlinked evidence file even with a matching digest',()=>{
 const tmp=mkdtempSync(join(tmpdir(),'epmo-s19-evidence-'));
 try {
  const evidence=join(tmp,'evidence');
  const outside=join(tmp,'private');
  mkdirSync(evidence); mkdirSync(outside);
  const manifest=fixture();
  for(const e of manifest.artifacts.slice(1))writeFileSync(join(evidence,e.path),bytes);
  const foreign=join(outside,'private.json');
  writeFileSync(foreign,bytes);
  symlinkSync(foreign,join(evidence,manifest.artifacts[0].path));
  const manifestPath=join(evidence,'manifest.json');
  writeFileSync(manifestPath,JSON.stringify(manifest));
  const result=verifyFromDisk(manifestPath);
  assert.equal(result.accepted,false);
  assert.ok(result.errors.includes('missing-artifact'));
  assert.equal(result.deploymentAuthorized,false);
  assert.equal(result.operationallyVerified,false);
 } finally {rmSync(tmp,{recursive:true,force:true});}
});

test('Q87 disk verifier accepts bounded regular synthetic files but never real provider proof',()=>{
 const tmp=mkdtempSync(join(tmpdir(),'epmo-s19-regular-'));
 try {
  const manifest=fixture();
  for(const e of manifest.artifacts)writeFileSync(join(tmp,e.path),bytes);
  const manifestPath=join(tmp,'manifest.json');
  writeFileSync(manifestPath,JSON.stringify(manifest));
  const result=verifyFromDisk(manifestPath);
  assert.equal(result.accepted,true);
  assert.equal(result.deploymentAuthorized,false);
  assert.equal(result.operationallyVerified,false);
 } finally {rmSync(tmp,{recursive:true,force:true});}
});

test('Q87 disk verifier rejects oversized regular evidence without reading into memory',()=>{
 const tmp=mkdtempSync(join(tmpdir(),'epmo-s19-huge-'));
 try {
  const manifest=fixture();
  for(const e of manifest.artifacts.slice(1))writeFileSync(join(tmp,e.path),bytes);
  writeFileSync(join(tmp,manifest.artifacts[0].path),Buffer.alloc(1024*1024+1));
  const manifestPath=join(tmp,'manifest.json');
  writeFileSync(manifestPath,JSON.stringify(manifest));
  const result=verifyFromDisk(manifestPath);
  assert.equal(result.accepted,false);
  assert.ok(result.errors.includes('missing-artifact'));
  assert.equal(result.deploymentAuthorized,false);
 } finally {rmSync(tmp,{recursive:true,force:true});}
});
