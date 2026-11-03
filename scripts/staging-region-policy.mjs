#!/usr/bin/env node
// Offline, fail-closed environment policy check. Never connects to a provider.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const sha=/^[a-f0-9]{40}$/;
const allowed=new Set(['shared-sa','dedicated-sa']);
export function validate(config) {
  const errors=[];
  const required=['profile','provider','region','approvedRegions','sourceSha','imageDigest','networkId','databaseId','storageId','kmsKeyId','secretStoreId','logSinkId','backupVaultId','restoreTargetId','apiOrigin','webOrigin','tlsMode','wafMode'];
  for(const key of required) if(!config[key]) errors.push('missing:'+key);
  if(!allowed.has(config.profile)) errors.push('invalid:profile');
  if(!Array.isArray(config.approvedRegions)||!config.approvedRegions.includes(config.region)) errors.push('region:not-approved');
  if(!sha.test(config.sourceSha||'')) errors.push('sourceSha:not-immutable');
  if(!/^sha256:[a-f0-9]{64}$/.test(config.imageDigest||'')) errors.push('imageDigest:not-immutable');
  for(const key of ['apiOrigin','webOrigin']) {
    try { const url=new URL(config[key]); if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash) errors.push(key+':not-https-origin'); }
    catch { errors.push(key+':invalid'); }
  }
  if(config.tlsMode!=='enforced'||config.wafMode!=='enforced') errors.push('edge:unprotected');
  if(config.backupEncrypted!==true||config.logsRedacted!==true||config.restoreIsolated!==true) errors.push('recovery-or-audit:unsafe');
  if(config.databaseMigrationMode!=='expand-only') errors.push('migration:not-expand-only');
  if(config.stripeMode!=='test'||config.allowLivePayments!==false) errors.push('billing:not-test-only');
  if(config.secretsInRepo!==false||config.usesStaticCloudKeys!==false) errors.push('credentials:unsafe');
  if(config.deploymentAuthorized!==false) errors.push('deployment:must-remain-disabled');
  if(config.profile==='dedicated-sa' && config.sharedResourceIds?.length) errors.push('dedicated:shared-resources');
  if(config.profile==='shared-sa' && config.tenantIsolation!=='rls-enforced') errors.push('shared:tenant-isolation');
  return errors;
}
if(process.argv[1] && resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  try {
    const path=process.argv[2]; if(!path) throw Error('configuration path required');
    const config=JSON.parse(readFileSync(path,'utf8'));
    const errors=validate(config);
    process.stdout.write(JSON.stringify({valid:errors.length===0,errors,offlineOnly:true,providerEligibilityVerified:false,releaseAccepted:false})+'\n');
    process.exitCode=errors.length?2:0;
  } catch { process.stderr.write('Configuration unavailable or malformed (contents withheld)\n'); process.exitCode=2; }
}
