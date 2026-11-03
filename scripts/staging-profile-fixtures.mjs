#!/usr/bin/env node
// Offline inventory templates only. Intentionally fail policy validation until approved.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const profiles=['shared-sa','dedicated-sa'];
export function makeProfile(profile) {
  if(!profiles.includes(profile)) throw Error('unsupported profile');
  const prefix=profile==='shared-sa'?'sa-shared':'sa-dedicated-CUSTOMER-ID';
  return {
    profile,provider:'UNVERIFIED',region:'UNVERIFIED',approvedRegions:[],
    sourceSha:'UNVERIFIED',imageDigest:'UNVERIFIED',
    networkId:prefix+'-vpc',apiRuntimeId:prefix+'-api',webRuntimeId:prefix+'-web',
    databaseId:prefix+'-postgres',storageId:prefix+'-objects',
    kmsKeyId:prefix+'-kms',secretStoreId:prefix+'-secrets',
    logSinkId:prefix+'-audit',backupVaultId:prefix+'-backup',
    restoreTargetId:prefix+'-isolated-restore',
    apiOrigin:'https://api.example.invalid/',webOrigin:'https://web.example.invalid/',
    tlsMode:'enforced',wafMode:'enforced',
    backupEncrypted:true,logsRedacted:true,restoreIsolated:true,
    databaseMigrationMode:'expand-only',stripeMode:'test',allowLivePayments:false,
    secretsInRepo:false,usesStaticCloudKeys:false,deploymentAuthorized:false,
    tenantIsolation:'rls-enforced',sharedResourceIds:[],
    leastPrivilegeVerified:false,monitoringVerified:false,providerEligibilityVerified:false,
    independentRestoreVerified:false,rollbackVerified:false,
    // Deliberately non-authoritative. Do not turn these into attestations.
    releaseAccepted:false
  };
}
export function assertSeparate(shared,dedicated) {
  const keys=['networkId','apiRuntimeId','webRuntimeId','databaseId','storageId',
    'kmsKeyId','secretStoreId','logSinkId','backupVaultId','restoreTargetId'];
  for(const key of keys) {
    if(!shared[key]||!dedicated[key]||shared[key]===dedicated[key]) throw Error('resource overlap:'+key);
  }
  if(shared.profile!=='shared-sa'||dedicated.profile!=='dedicated-sa') throw Error('wrong profiles');
  return true;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  // Print only nonsecret, deliberately unapproved inventory; never touch cloud.
  const shared=makeProfile('shared-sa'),dedicated=makeProfile('dedicated-sa');
  assertSeparate(shared,dedicated);
  process.stdout.write(JSON.stringify({offlineOnly:true,deployable:false,
    profiles:[shared,dedicated]},null,2)+'\n');
}
