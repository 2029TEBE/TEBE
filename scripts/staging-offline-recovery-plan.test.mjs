import test from 'node:test';
import assert from 'node:assert/strict';
import { makeProfile } from './staging-profile-fixtures.mjs';
import { planRelease } from './staging-offline-recovery-plan.mjs';
const sha='a'.repeat(40),prev='b'.repeat(40),digest='sha256:'+'c'.repeat(64),old='sha256:'+'d'.repeat(64);
function fixture(){
  const config={...makeProfile('shared-sa'),provider:'offline-provider',region:'sa-placeholder',
    approvedRegions:['sa-placeholder'],sourceSha:sha,imageDigest:digest};
  const request={candidateSha:sha,imageDigest:digest,previousSha:prev,previousImageDigest:old,
    migrationMode:'expand-only',allowDestructiveMigration:false,backupEncrypted:true,
    backupOffHost:true,backupVaultId:config.backupVaultId,restoreTargetId:config.restoreTargetId,
    restoreUsesSyntheticData:true,restoreVerified:false,healthPath:'/health',
    metricsAccess:'private',alertsConfigured:true,execute:false,deploymentAuthorized:false};
  return {config,request};
}
test('offline plan is nondeployable even when inputs pass',()=>{
  const {config,request}=fixture(); const result=planRelease(config,request);
  assert.deepEqual(result.errors,[]);assert.equal(result.accepted,true);
  assert.equal(result.plan.executed,false);assert.equal(result.releaseAccepted,false);
  assert.equal(result.deployable,false);
});
for(const [label,mutation,expected] of [
  ['changed source',r=>r.candidateSha=prev,'candidate:sha-mismatch'],
  ['mutable image',r=>r.imageDigest='latest','candidate:image-mismatch'],
  ['missing rollback',r=>r.previousSha=sha,'rollback:previous-sha-required'],
  ['destructive migration',r=>r.allowDestructiveMigration=true,'migration:unsafe'],
  ['local backup',r=>r.backupOffHost=false,'backup:unsafe'],
  ['production restore',r=>r.restoreTargetId='sa-shared-postgres','restore:not-isolated'],
  ['unverified health',r=>r.metricsAccess='public','observability:unsafe'],
  ['execute flag',r=>r.execute=true,'execution:prohibited'],
]) test('reject '+label,()=>{const {config,request}=fixture();mutation(request);
  const result=planRelease(config,request);assert.ok(result.errors.includes(expected));assert.equal(result.plan,null);
});
test('unapproved region fails closed',()=>{const {config,request}=fixture();config.approvedRegions=[];
  assert.ok(planRelease(config,request).errors.includes('region:not-approved'));
});
