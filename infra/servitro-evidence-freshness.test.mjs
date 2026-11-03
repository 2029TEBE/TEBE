import test from 'node:test';
import assert from 'node:assert/strict';
import {checkEvidenceFreshness} from './servitro-evidence-freshness.mjs';
const now=new Date('2026-11-03T15:00:00Z');
const kinds=['image-attestation','https-health','nonprod-isolation','encrypted-backup','isolated-restore','alert-delivery','rollback-drill','independent-review'];
const sha='a'.repeat(40), digest='sha256:'+'b'.repeat(64);
const valid=()=>({releaseSha:sha,imageDigest:digest,environment:'isolated-nonproduction',evidence:kinds.map(kind=>({kind,releaseSha:sha,imageDigest:digest,environment:'isolated-nonproduction',result:'pass',observedAt:'2026-11-03T14:50:00Z'}))});
test('coherent synthetic metadata passes offline only',()=>{const r=checkEvidenceFreshness(valid(),now);assert.equal(r.accepted,true);assert.equal(r.operationallyVerified,false);assert.equal(r.deploymentAuthorized,false);});
for(const [name,change] of [
 ['missing',x=>x.evidence.pop()],
 ['duplicate',x=>x.evidence[1].kind=x.evidence[0].kind],
 ['wrong release',x=>x.evidence[0].releaseSha='c'.repeat(40)],
 ['wrong digest',x=>x.evidence[0].imageDigest='sha256:'+'c'.repeat(64)],
 ['production environment',x=>x.environment='production'],
 ['future receipt',x=>x.evidence[0].observedAt='2026-11-04T14:50:00Z'],
 ['stale health',x=>x.evidence[1].observedAt='2026-11-03T12:00:00Z'],
 ['failed receipt',x=>x.evidence[0].result='fail'],
 ['unknown field',x=>x.evidence[0].secret='do-not-log'],
 ['invalid date',x=>x.evidence[0].observedAt='yesterday'],
 ['unknown category',x=>x.evidence[0].kind='billing'],
 ['bad SHA',x=>x.releaseSha='latest'],
 ['bad digest',x=>x.imageDigest='latest']
]) test('rejects '+name,()=>{const x=valid();change(x);const r=checkEvidenceFreshness(x,now);assert.equal(r.accepted,false);assert.equal(r.deploymentAuthorized,false);assert.doesNotMatch(JSON.stringify(r),/do-not-log/);});
