#!/usr/bin/env node
// Offline-only Servitro acceptance preflight. Never reads credentials or contacts a host.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^sha256:[a-f0-9]{64}$/;
const HTTPS=/^https:\/\/[a-z0-9.-]+(?::443)?$/i;
const SECRET=/(sk_live_|rk_live_|whsec_|-----BEGIN|password|secret|token|credential)/i;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
export function validateServitroPreflight(c){
 const errors=[];
 const requireField=(ok,key)=>{if(!ok)errors.push(key);};
 if(!c||typeof c!=='object'||Array.isArray(c))return {ok:false,errors:['invalid-document'],deployAuthorized:false};
 requireField(c.environment==='isolated-nonprod','environment');
 requireField(c.provider==='servitro','provider');
 requireField(c.residencyApproved===false,'residency-claim');
 requireField(c.deploymentAuthorized===false,'deployment-authorization');
 requireField(typeof c.sourceSha==='string'&&SHA.test(c.sourceSha),'source-sha');
 requireField(typeof c.imageDigest==='string'&&DIGEST.test(c.imageDigest),'image-digest');
 requireField(c.attestedSourceSha===c.sourceSha&&SHA.test(c.attestedSourceSha||''),'attestation-binding');
 requireField(c.webOrigin==='https://app.theepmo.com','web-origin');
 requireField(c.mailTransport==='smtp' || c.mailTransport==='disabled','mail-transport');
 requireField(c.stripeMode==='test'&&c.stripeLiveEnabled===false,'stripe-test');
 requireField(c.healthUrl==='https://app.theepmo.com/healthz','health-url');
 requireField(c.tlsVerify===true&&c.healthProbeMethod==='GET','https-probe');
 requireField(c.backupEncrypted===true&&c.backupOffHost===true&&c.restoreTarget==='isolated-disposable','restore-plan');
 requireField(c.rollbackSourceSha!==c.sourceSha&&SHA.test(c.rollbackSourceSha||''),'rollback-sha');
 requireField(c.migrationMode==='expand-only','migration-safety');
 requireField(c.alertsConfigured===false&&c.alertPlanReviewed===true,'alert-plan');
 requireField(c.runtimeEvidenceVerified===false&&c.restoreDrillVerified===false,'external-evidence');
 // Explicit allowlist: unexpected keys may contain credentials and must never be echoed.
 const allowed=new Set(['environment','provider','residencyApproved','deploymentAuthorized','sourceSha','imageDigest','attestedSourceSha','webOrigin','mailTransport','stripeMode','stripeLiveEnabled','healthUrl','tlsVerify','healthProbeMethod','backupEncrypted','backupOffHost','restoreTarget','rollbackSourceSha','migrationMode','alertsConfigured','alertPlanReviewed','runtimeEvidenceVerified','restoreDrillVerified']);
 for(const k of Object.keys(c))if(!allowed.has(k))errors.push('unknown-field');
 // Never output input values.
 return {ok:errors.length===0,errors:[...new Set(errors)],deployAuthorized:false,operationallyVerified:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==3)throw Error('usage');
  const data=readFileSync(process.argv[2],'utf8');
  if(data.length>16384)throw Error('oversize');
  const result=validateServitroPreflight(JSON.parse(data));
  process.stdout.write(JSON.stringify(result)+'\n');
  if(!result.ok)process.exitCode=2;
 }catch{process.stderr.write('Preflight rejected; input contents withheld\n');process.exitCode=2;}
}
