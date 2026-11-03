#!/usr/bin/env node
// S13: offline-only immutable release and isolated recovery plan. No external I/O.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validate } from './staging-region-policy.mjs';
const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^sha256:[a-f0-9]{64}$/;
const ID=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/;
export function planRelease(config, request) {
  const errors=validate(config);
  if(!request || typeof request!=='object' || Array.isArray(request)) return {accepted:false,errors:['request:invalid',...errors],offlineOnly:true,releaseAccepted:false};
  if(!SHA.test(request.candidateSha||'') || request.candidateSha!==config.sourceSha) errors.push('candidate:sha-mismatch');
  if(!DIGEST.test(request.imageDigest||'') || request.imageDigest!==config.imageDigest) errors.push('candidate:image-mismatch');
  if(!SHA.test(request.previousSha||'') || request.previousSha===request.candidateSha) errors.push('rollback:previous-sha-required');
  if(!DIGEST.test(request.previousImageDigest||'') || request.previousImageDigest===request.imageDigest) errors.push('rollback:previous-digest-required');
  if(request.migrationMode!=='expand-only' || request.allowDestructiveMigration!==false) errors.push('migration:unsafe');
  if(request.backupEncrypted!==true || request.backupOffHost!==true || !ID.test(request.backupVaultId||'') || request.backupVaultId!==config.backupVaultId) errors.push('backup:unsafe');
  if(!ID.test(request.restoreTargetId||'') || request.restoreTargetId!==config.restoreTargetId || request.restoreTargetId===config.databaseId) errors.push('restore:not-isolated');
  if(request.restoreUsesSyntheticData!==true || request.restoreVerified!==false) errors.push('restore:offline-only');
  if(request.healthPath!=='/health' || request.metricsAccess!=='private' || request.alertsConfigured!==true) errors.push('observability:unsafe');
  if(request.execute!==false || request.deploymentAuthorized!==false) errors.push('execution:prohibited');
  return {accepted:errors.length===0,errors,offlineOnly:true,deployable:false,releaseAccepted:false,
    plan:errors.length?null:{profile:config.profile,candidateSha:request.candidateSha,imageDigest:request.imageDigest,
      previousSha:request.previousSha,previousImageDigest:request.previousImageDigest,
      backupVaultId:request.backupVaultId,restoreTargetId:request.restoreTargetId,
      phases:['verify-provider-and-region-externally','attest-target-and-source-sha','capture-encrypted-offhost-backup',
        'perform-isolated-synthetic-restore','review-expand-only-migration','verify-private-health-metrics-and-alerts',
        'authorize-deployment-separately','deploy-immutable-digest','verify-tenant-isolation',
        'rollback-to-previous-immutable-digest-if-needed'],
      requiresIndependentOperatorApproval:true,executed:false}};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try {
    if(process.argv.length!==4) throw Error('arguments');
    const config=JSON.parse(readFileSync(process.argv[2],'utf8'));
    const request=JSON.parse(readFileSync(process.argv[3],'utf8'));
    const result=planRelease(config,request);
    process.stdout.write(JSON.stringify(result)+'\n');
    if(!result.accepted) process.exitCode=2;
  } catch {
    process.stderr.write('Invalid offline recovery input (contents withheld)\n');
    process.exitCode=2;
  }
}
