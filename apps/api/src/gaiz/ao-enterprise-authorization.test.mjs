import test from 'node:test';
import assert from 'node:assert/strict';
import {assessAoEnterpriseTask as assess} from './ao-enterprise-authorization.mjs';
const task={version:'1.0.0',requestId:'request-001',taskId:'task-00001',toolId:'ao.report.read',tenantId:'tenant-a',principalId:'user-1',intent:{}};
const tool={id:'ao.report.read',version:'1.0.0',owner:'TEBE',risk:'read',transport:'tebe_api',enabled:true,requiresApproval:false,timeoutMs:1000};
const principal={authenticated:true,serverVerified:true,tenantId:'tenant-a',principalId:'user-1',active:true,roles:['analyst']};
const entitlement={serverVerified:true,tenantId:'tenant-a',principalId:'user-1',allowedToolIds:['ao.report.read']};
const approval={serverVerified:true,requestId:'request-001',toolId:'ao.report.read',tenantId:'tenant-a',principalId:'user-1',verdict:'ALLOW',approvedBy:'reviewer-1',policyVersion:'1.0.0'};
const check=overrides=>assess({task,tool,principal,entitlement,...overrides});
test('source-only preflight never permits execution',()=>{
 const result=check();assert.equal(result.status,'ELIGIBLE_FOR_REVIEW');
 assert.equal(result.executionEnabled,false);assert.equal(result.requiresDurableReplayReservation,true);
});
test('requires exact tenant and principal binding',()=>{
 for(const p of [{...principal,tenantId:'tenant-b'},{...principal,principalId:'user-2'},
  {...principal,authenticated:false},{...principal,serverVerified:false},{...principal,active:false}])
 assert.equal(check({principal:p}).status,'DENY');
});
test('requires trusted tenant-bound entitlement',()=>{
 for(const e of [{...entitlement,serverVerified:false},{...entitlement,tenantId:'tenant-b'},
  {...entitlement,principalId:'user-2'},{...entitlement,allowedToolIds:['other']}])
 assert.equal(check({entitlement:e}).status,'DENY');
});
test('rejects unknown or client-enabled tool capability',()=>{
 for(const t of [{...tool,enabled:false},{...tool,risk:'shell'},
  {...tool,transport:'shell'},{...tool,id:'other-tool'},{...tool,timeoutMs:999999}])
 assert.equal(check({tool:t}).status,'DENY');
});
test('high-risk tools require exact verified human approval',()=>{
 const write={...tool,risk:'privileged',requiresApproval:true};
 assert.equal(check({tool:write}).status,'DENY');
 assert.equal(check({tool:write,approval:{...approval,tenantId:'tenant-b'}}).status,'DENY');
 assert.equal(check({tool:write,approval:{...approval,verdict:'ASK'}}).status,'DENY');
 assert.equal(check({tool:write,approval:{...approval,serverVerified:false}}).status,'DENY');
 const result=check({tool:write,approval});assert.equal(result.status,'ELIGIBLE_FOR_REVIEW');
 assert.equal(result.executionEnabled,false);
});
test('untrusted intent and artifact references are rejected',()=>{
 for(const t of [{...task,intent:{command:'shell'}},{...task,artifactRefs:['secret']},
  {...task,version:'2.0.0'},{...task,unexpected:true},{...task,requestId:'a'}])
 assert.equal(check({task:t}).status,'DENY');
});
test('empty or spoofed trust context grants no permissions',()=>{
 assert.equal(assess().status,'DENY');
 assert.equal(check({entitlement:null}).status,'DENY');
 assert.equal(check({principal:{...principal,privileged:true}}).status,'DENY');
});
