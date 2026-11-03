#!/usr/bin/env node
// S15: offline inventory isolation guard. Never provisions or reads cloud resources.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validate } from './staging-region-policy.mjs';

const KEYS=['networkId','apiRuntimeId','webRuntimeId','databaseId','storageId',
  'kmsKeyId','secretStoreId','logSinkId','backupVaultId','restoreTargetId'];
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const OWN=Object.prototype.hasOwnProperty;
function safeRecord(value) {
  return value!==null && typeof value==='object' && !Array.isArray(value);
}
export function verifyIsolation(inventory) {
  const errors=[];
  if(!safeRecord(inventory) || !Array.isArray(inventory.profiles) ||
      inventory.profiles.length!==2 || !inventory.profiles.every(safeRecord)) {
    return {valid:false,errors:['inventory:invalid'],offlineOnly:true,
      physicalIsolationVerified:false,releaseAccepted:false};
  }
  const [shared,dedicated]=inventory.profiles;
  if(shared.profile!=='shared-sa'||dedicated.profile!=='dedicated-sa')
    errors.push('profiles:order-or-type');
  for(const [index,profile] of inventory.profiles.entries()) {
    const prefix=index===0?'shared':'dedicated';
    for(const key of KEYS) {
      if(!OWN.call(profile,key)||typeof profile[key]!=='string'||!ID.test(profile[key]))
        errors.push(prefix+':invalid:'+key);
    }
    // This inventory is an offline contract, not a provider eligibility attestation.
    if(profile.deploymentAuthorized!==false||profile.releaseAccepted!==false)
      errors.push(prefix+':authorization-must-be-disabled');
    if(profile.providerEligibilityVerified!==false||profile.independentRestoreVerified!==false||
       profile.rollbackVerified!==false)
      errors.push(prefix+':external-evidence-must-remain-unverified');
    // Validate policy, but never print potentially sensitive configuration values.
    for(const code of validate(profile)) errors.push(prefix+':policy:'+code);
  }
  for(const key of KEYS) {
    if(shared[key]===dedicated[key]) errors.push('overlap:'+key);
  }
  // Also block a collision across resource types, not just matching columns.
  const seen=new Set();
  for(const profile of inventory.profiles) for(const key of KEYS) {
    const value=profile[key];
    if(typeof value!=='string'||!ID.test(value)) continue;
    if(seen.has(value)) errors.push('duplicate-resource-id');
    seen.add(value);
  }
  return {valid:errors.length===0,errors:[...new Set(errors)],
    offlineOnly:true,physicalIsolationVerified:false,releaseAccepted:false};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    if(process.argv.length!==3) throw Error('usage');
    const input=JSON.parse(readFileSync(process.argv[2],'utf8'));
    const result=verifyIsolation(input);
    process.stdout.write(JSON.stringify(result)+'\n');
    if(!result.valid) process.exitCode=2;
  } catch {
    process.stderr.write('Offline inventory unavailable or malformed (contents withheld)\n');
    process.exitCode=2;
  }
}
