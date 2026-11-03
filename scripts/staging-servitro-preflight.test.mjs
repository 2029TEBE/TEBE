import test from 'node:test';
import assert from 'node:assert/strict';
import {validateServitroPreflight} from './staging-servitro-preflight.mjs';
const sha='a'.repeat(40), old='b'.repeat(40);
function fixture(){return {environment:'isolated-nonprod',provider:'servitro',residencyApproved:false,deploymentAuthorized:false,sourceSha:sha,attestedSourceSha:sha,imageDigest:'sha256:'+'c'.repeat(64),webOrigin:'https://app.theepmo.com',mailTransport:'smtp',stripeMode:'test',stripeLiveEnabled:false,healthUrl:'https://app.theepmo.com/healthz',tlsVerify:true,healthProbeMethod:'GET',backupEncrypted:true,backupOffHost:true,restoreTarget:'isolated-disposable',rollbackSourceSha:old,migrationMode:'expand-only',alertsConfigured:false,alertPlanReviewed:true,runtimeEvidenceVerified:false,restoreDrillVerified:false};}
test('offline plan is accepted but never operationally verified',()=>{const r=validateServitroPreflight(fixture());assert.equal(r.ok,true);assert.equal(r.deployAuthorized,false);assert.equal(r.operationallyVerified,false)});
for(const [key,value] of [['environment','production'],['provider','other'],['residencyApproved',true],['deploymentAuthorized',true],['sourceSha','latest'],['attestedSourceSha',old],['imageDigest','latest'],['webOrigin','http://app.theepmo.com'],['mailTransport','sendmail'],['stripeMode','live'],['stripeLiveEnabled',true],['healthUrl','http://app.theepmo.com/healthz'],['tlsVerify',false],['backupOffHost',false],['restoreTarget','production'],['rollbackSourceSha',sha],['migrationMode','drop-and-recreate'],['alertPlanReviewed',false],['runtimeEvidenceVerified',true]]){
 test('rejects unsafe '+key,()=>{const c=fixture();c[key]=value;assert.equal(validateServitroPreflight(c).ok,false)});
}
test('unknown fields rejected without echoing credentials',()=>{const c=fixture();c.password='highly-private';const r=validateServitroPreflight(c);assert.equal(r.ok,false);assert.doesNotMatch(JSON.stringify(r),/highly-private/)});
test('invalid document rejected',()=>assert.equal(validateServitroPreflight(null).ok,false));
