#!/usr/bin/env node
// S16: offline monitoring contract. No network calls, provider access or alert creation.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const OWN=Object.prototype.hasOwnProperty;
const METRICS=['apiAvailability','webAvailability','http5xxRate','requestLatencyP95','databaseConnectivity','backupAgeHours','restoreDrillAgeDays','certificateExpiryDays'];
const ID=/^[a-z][a-z0-9-]{2,63}$/;
function record(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
export function validateMonitoring(input){
  const errors=[];
  if(!record(input)||!Array.isArray(input.profiles)||input.profiles.length!==2||
      !input.profiles.every(record)) return {valid:false,errors:['monitoring:invalid'],offlineOnly:true,operationallyVerified:false};
  const seen=new Set();
  for(const [i,p] of input.profiles.entries()){
    const expected=i===0?'shared-sa':'dedicated-sa',tag=i===0?'shared':'dedicated';
    if(p.profile!==expected)errors.push(tag+':profile');
    if(typeof p.monitoringNamespace!=='string'||!ID.test(p.monitoringNamespace)||seen.has(p.monitoringNamespace))
      errors.push(tag+':namespace');
    else seen.add(p.monitoringNamespace);
    if(p.metricsPrivate!==true||p.metricsAuthRequired!==true||p.logsRedacted!==true||
       p.auditPayloadLogging!==false)errors.push(tag+':telemetry-exposure');
    if(p.alertDeliveryConfigured!==false||p.operationallyVerified!==false||p.deploymentAuthorized!==false)
      errors.push(tag+':external-claims');
    if(!record(p.alerts)) {errors.push(tag+':alerts');continue;}
    for(const key of METRICS){
      if(!OWN.call(p.alerts,key)||p.alerts[key]!==true)errors.push(tag+':missing-alert:'+key);
    }
    if(!Number.isInteger(p.retentionDays)||p.retentionDays<1||p.retentionDays>90)
      errors.push(tag+':retention');
    if(typeof p.healthPath!=='string'||p.healthPath!=='/healthz'||
       p.readinessPath!=='/readyz')errors.push(tag+':health-path');
    if(p.probeIncludesSecrets!==false||p.probeIncludesTenantData!==false)
      errors.push(tag+':probe-data');
  }
  return {valid:errors.length===0,errors:[...new Set(errors)],offlineOnly:true,operationallyVerified:false};
}
export function makeMonitoringFixture(){
  return {profiles:['shared-sa','dedicated-sa'].map((profile,i)=>({
    profile,monitoringNamespace:i===0?'sa-shared-monitoring':'sa-dedicated-monitoring',
    metricsPrivate:true,metricsAuthRequired:true,logsRedacted:true,auditPayloadLogging:false,
    alertDeliveryConfigured:false,operationallyVerified:false,deploymentAuthorized:false,
    alerts:Object.fromEntries(METRICS.map(k=>[k,true])),retentionDays:30,
    healthPath:'/healthz',readinessPath:'/readyz',probeIncludesSecrets:false,probeIncludesTenantData:false
  }))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==3)throw Error('usage');
    const result=validateMonitoring(JSON.parse(readFileSync(process.argv[2],'utf8')));
    process.stdout.write(JSON.stringify(result)+'\n');
    if(!result.valid)process.exitCode=2;
  }catch{
    process.stderr.write('Offline monitoring contract unavailable or malformed (contents withheld)\n');
    process.exitCode=2;
  }
}
