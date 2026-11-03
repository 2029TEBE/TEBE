#!/usr/bin/env node
// S20: offline temporal/coherence gate; never a substitute for independent provider receipts.
const SHA=/^[0-9a-f]{40}$/;
const DIGEST=/^sha256:[0-9a-f]{64}$/;
const KINDS=['image-attestation','https-health','nonprod-isolation','encrypted-backup','isolated-restore','alert-delivery','rollback-drill','independent-review'];
const MAX_AGE_HOURS={'image-attestation':24,'https-health':1,'nonprod-isolation':24,'encrypted-backup':24,'isolated-restore':720,'alert-delivery':24,'rollback-drill':720,'independent-review':168};
const parseTime=x=>typeof x==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(x) ? Date.parse(x):NaN;
export function checkEvidenceFreshness(input, now=new Date()) {
 const errors=[];
 if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(k=>!['releaseSha','imageDigest','environment','evidence'].includes(k)))
   return {accepted:false,operationallyVerified:false,deploymentAuthorized:false,errors:['schema']};
 if(!SHA.test(input.releaseSha??'')) errors.push('release-sha');
 if(!DIGEST.test(input.imageDigest??'')) errors.push('image-digest');
 if(input.environment!=='isolated-nonproduction') errors.push('environment');
 const current=now instanceof Date?now.getTime():NaN;
 if(!Number.isFinite(current)) errors.push('clock');
 if(!Array.isArray(input.evidence) || input.evidence.length!==KINDS.length) errors.push('evidence-count');
 const seen=new Set();
 for(const e of Array.isArray(input.evidence)?input.evidence.slice(0,32):[]) {
  if(!e || typeof e!=='object' || Array.isArray(e) || Object.keys(e).some(k=>!['kind','releaseSha','observedAt','environment','imageDigest','result'].includes(k))) {errors.push('entry-schema');continue;}
  if(!KINDS.includes(e.kind)||seen.has(e.kind)) {errors.push('duplicate-or-unknown-kind');continue;}
  seen.add(e.kind);
  if(e.releaseSha!==input.releaseSha || e.imageDigest!==input.imageDigest || e.environment!==input.environment) errors.push('identity-mismatch');
  if(e.result!=='pass') errors.push('not-passed');
  const observed=parseTime(e.observedAt);
  if(!Number.isFinite(observed)||!Number.isFinite(current)||observed>current+300000||current-observed>MAX_AGE_HOURS[e.kind]*3600000) errors.push('stale-or-future');
 }
 if(KINDS.some(k=>!seen.has(k))) errors.push('missing-evidence');
 return {accepted:errors.length===0,operationallyVerified:false,deploymentAuthorized:false,errors:[...new Set(errors)]};
}
