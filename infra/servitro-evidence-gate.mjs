#!/usr/bin/env node
// Offline-only acceptance evidence gate: NEVER contacts provider or authorizes deployment.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const sha=/^[a-f0-9]{40}$/;
const digest=/^sha256:[a-f0-9]{64}$/;
const iso=(v)=>typeof v==='string'&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString()===v;
const fields=['provider','environment','sourceSha','imageDigest','deployedSourceSha','attestation','health','isolation','backup','restore','alerts','rollback','review'];
export function checkEvidence(c){
 const errors=[];
 if(!c||typeof c!=='object'||Array.isArray(c))return {accepted:false,errors:['invalid-document'],deploymentAuthorized:false};
 for(const k of Object.keys(c))if(!fields.includes(k))errors.push('unknown-field');
 if(c.provider!=='servitro'||c.environment!=='isolated-nonprod')errors.push('target');
 if(!sha.test(c.sourceSha||'')||!sha.test(c.deployedSourceSha||'')||c.sourceSha!==c.deployedSourceSha)errors.push('deployed-sha');
 if(!digest.test(c.imageDigest||''))errors.push('image-digest');
 if(c.attestation?.sourceSha!==c.sourceSha||c.attestation?.imageDigest!==c.imageDigest||c.attestation?.verifiedByIndependentOperator!==true||!iso(c.attestation?.observedAt))errors.push('image-attestation');
 if(c.health?.url?.startsWith('https://')!==true||c.health?.tlsVerified!==true||c.health?.status!==200||c.health?.sourceSha!==c.sourceSha||!iso(c.health?.observedAt))errors.push('https-health');
 if(c.isolation?.separateNetwork!==true||c.isolation?.separateDatabase!==true||c.isolation?.syntheticTenantsOnly!==true||c.isolation?.independentlyVerified!==true)errors.push('isolation');
 if(c.backup?.encrypted!==true||c.backup?.offHost!==true||c.backup?.immutableReferenceVerified!==true||!iso(c.backup?.observedAt))errors.push('backup');
 if(c.restore?.isolatedDisposable!==true||c.restore?.integrityVerified!==true||c.restore?.sourceBackupReference!==c.backup?.reference||!iso(c.restore?.observedAt))errors.push('restore');
 if(c.alerts?.deliveryVerified!==true||c.alerts?.healthFailureVerified!==true||c.alerts?.backupFreshnessVerified!==true||!iso(c.alerts?.observedAt))errors.push('alerts');
 if(!sha.test(c.rollback?.sourceSha||'')||c.rollback?.sourceSha===c.sourceSha||c.rollback?.nonDestructiveMigration!==true||c.rollback?.drillVerified!==true||!iso(c.rollback?.observedAt))errors.push('rollback');
 if(c.review?.independentApproval!==true||c.review?.releaseCandidateSha!==c.sourceSha||!iso(c.review?.observedAt))errors.push('review');
 // No credential values, host responses, or supplied evidence are ever echoed.
 return {accepted:errors.length===0,errors:[...new Set(errors)],deploymentAuthorized:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==3)throw Error('usage');const raw=readFileSync(process.argv[2],'utf8');if(raw.length>32768)throw Error('oversize');const result=checkEvidence(JSON.parse(raw));process.stdout.write(JSON.stringify(result)+'\n');if(!result.accepted)process.exitCode=2;}
 catch{process.stderr.write('Evidence rejected; input withheld\n');process.exitCode=2;}
}
