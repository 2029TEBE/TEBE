#!/usr/bin/env node
// Read-only evidence inventory: never probes a host or reads secrets.
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
const SHA=/^[a-f0-9]{40}$/i, DIGEST=/^sha256:[a-f0-9]{64}$/i;
export function validateOpsEvidence(input, now=Date.now()) {
 const errors=[];
 if (!input || typeof input!=='object' || Array.isArray(input)) return {accepted:false,errors:['invalid manifest'],deploymentAuthorized:false};
 const expected=['releaseSha','imageDigest','environment','evidence'];
 for(const k of Object.keys(input)) if(!expected.includes(k)) errors.push('unexpected manifest field');
 if(!SHA.test(input.releaseSha||'')) errors.push('invalid release SHA');
 if(!DIGEST.test(input.imageDigest||'')) errors.push('invalid image digest');
 if(input.environment!=='isolated-nonproduction') errors.push('environment not isolated nonproduction');
 const kinds=['deployed-image','https-health','tenant-rls','encrypted-offhost-backup','isolated-restore','alert-delivery','protected-rollback','mail-two-way'];
 if(!Array.isArray(input.evidence)) errors.push('missing evidence array');
 else {
  const seen=new Set();
  for(const e of input.evidence){
   if(!e || typeof e!=='object' || Array.isArray(e)){errors.push('invalid receipt');continue}
   if(Object.keys(e).some(k=>!['kind','releaseSha','observedAt','status','reference'].includes(k))) errors.push('unexpected receipt field');
   if(!kinds.includes(e.kind)||seen.has(e.kind)) errors.push('duplicate or unknown evidence kind');
   seen.add(e.kind);
   if(e.releaseSha!==input.releaseSha) errors.push('receipt SHA mismatch');
   if(e.status!=='verified') errors.push('receipt not independently verified');
   const time=Date.parse(e.observedAt);
   if(!Number.isFinite(time)||time>now||now-time>86400000) errors.push('stale or invalid observation');
   if(typeof e.reference!=='string'||!/^https:\/\/[a-z0-9.-]+\/[a-zA-Z0-9/_#.?=&%-]+$/i.test(e.reference)) errors.push('invalid evidence reference');
  }
  for(const kind of kinds) if(!seen.has(kind)) errors.push('missing '+kind);
 }
 return {accepted:errors.length===0,errors,deploymentAuthorized:false,operationallyVerified:false};
}
if(process.argv[1] && resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 try{
  const file=resolve(process.argv[2]||'');
  if(!process.argv[2]||lstatSync(file).isSymbolicLink()||!lstatSync(file).isFile()||lstatSync(file).size>1048576||realpathSync(file)!==file) throw Error('unsafe input file');
  const result=validateOpsEvidence(JSON.parse(readFileSync(file,'utf8')));
  console.log(JSON.stringify(result));
  process.exitCode=result.accepted?0:1;
 }catch{console.error('Evidence validation failed (no sensitive details logged)');process.exitCode=1}
}
