import test from 'node:test';
import assert from 'node:assert/strict';
import {checkEvidence} from './servitro-evidence-gate.mjs';
const s='a'.repeat(40),old='b'.repeat(40),d='sha256:'+'c'.repeat(64),t='2026-11-03T12:00:00.000Z';
const fixture=()=>({provider:'servitro',environment:'isolated-nonprod',sourceSha:s,deployedSourceSha:s,imageDigest:d,attestation:{sourceSha:s,imageDigest:d,verifiedByIndependentOperator:true,observedAt:t},health:{url:'https://staging.example.invalid/healthz',tlsVerified:true,status:200,sourceSha:s,observedAt:t},isolation:{separateNetwork:true,separateDatabase:true,syntheticTenantsOnly:true,independentlyVerified:true},backup:{reference:'offline-backup-ref',encrypted:true,offHost:true,immutableReferenceVerified:true,observedAt:t},restore:{sourceBackupReference:'offline-backup-ref',isolatedDisposable:true,integrityVerified:true,observedAt:t},alerts:{deliveryVerified:true,healthFailureVerified:true,backupFreshnessVerified:true,observedAt:t},rollback:{sourceSha:old,nonDestructiveMigration:true,drillVerified:true,observedAt:t},review:{independentApproval:true,releaseCandidateSha:s,observedAt:t}});
test('complete synthetic evidence shape is accepted as declaration only, never deployment',()=>{const r=checkEvidence(fixture());assert.equal(r.accepted,true);assert.equal(r.deploymentAuthorized,false)});
for(const [label,mutate,code] of [
 ['missing deployed SHA',x=>x.deployedSourceSha=old,'deployed-sha'],
 ['digest mismatch',x=>x.attestation.imageDigest='sha256:'+'d'.repeat(64),'image-attestation'],
 ['unverified TLS',x=>x.health.tlsVerified=false,'https-health'],
 ['unverified tenant isolation',x=>x.isolation.independentlyVerified=false,'isolation'],
 ['unencrypted backup',x=>x.backup.encrypted=false,'backup'],
 ['restore mismatch',x=>x.restore.sourceBackupReference='wrong','restore'],
 ['missing alert delivery',x=>x.alerts.deliveryVerified=false,'alerts'],
 ['destructive rollback',x=>x.rollback.nonDestructiveMigration=false,'rollback'],
 ['missing independent review',x=>x.review.independentApproval=false,'review'],
 ['unknown credential field',x=>x.password='SHOULD_NOT_LEAK','unknown-field']
])test(label,()=>{const x=fixture();mutate(x);const r=checkEvidence(x);assert.equal(r.accepted,false);assert.ok(r.errors.includes(code));assert.ok(!JSON.stringify(r).includes('SHOULD_NOT_LEAK'))});
test('invalid document fails closed',()=>assert.equal(checkEvidence(null).accepted,false));
