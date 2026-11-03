import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOpsEvidence} from './servitro-ops-inventory.mjs';
const sha='a'.repeat(40),digest='sha256:'+'b'.repeat(64),now=Date.parse('2026-11-03T20:00:00Z');
const kinds=['deployed-image','https-health','tenant-rls','encrypted-offhost-backup','isolated-restore','alert-delivery','protected-rollback','mail-two-way'];
function sample(){return {releaseSha:sha,imageDigest:digest,environment:'isolated-nonproduction',evidence:kinds.map((kind,i)=>({kind,releaseSha:sha,observedAt:'2026-11-03T19:00:00Z',status:'verified',reference:'https://evidence.example.test/receipt/'+i}))}}
test('valid declarations remain nonauthoritative',()=>{const r=validateOpsEvidence(sample(),now);assert.equal(r.accepted,true);assert.equal(r.deploymentAuthorized,false);assert.equal(r.operationallyVerified,false)});
test('missing evidence fails',()=>{const m=sample();m.evidence.pop();assert.equal(validateOpsEvidence(m,now).accepted,false)});
test('failed independent check fails',()=>{const m=sample();m.evidence[0].status='pending';assert.equal(validateOpsEvidence(m,now).accepted,false)});
test('stale check fails',()=>{const m=sample();m.evidence[0].observedAt='2026-10-30T19:00:00Z';assert.equal(validateOpsEvidence(m,now).accepted,false)});
test('future check fails',()=>{const m=sample();m.evidence[0].observedAt='2026-11-04T19:00:00Z';assert.equal(validateOpsEvidence(m,now).accepted,false)});
test('release mismatch fails',()=>{const m=sample();m.evidence[0].releaseSha='c'.repeat(40);assert.equal(validateOpsEvidence(m,now).accepted,false)});
test('unexpected credential field fails without leaking',()=>{const m=sample();m.evidence[0].secret='private';const r=validateOpsEvidence(m,now);assert.equal(r.accepted,false);assert.ok(!JSON.stringify(r).includes('private'))});
test('invalid image digest fails',()=>{const m=sample();m.imageDigest='latest';assert.equal(validateOpsEvidence(m,now).accepted,false)});
test('production designation fails',()=>{const m=sample();m.environment='production';assert.equal(validateOpsEvidence(m,now).accepted,false)});
test('duplicate evidence fails',()=>{const m=sample();m.evidence[1].kind=m.evidence[0].kind;assert.equal(validateOpsEvidence(m,now).accepted,false)});
