import test from 'node:test';
import assert from 'node:assert/strict';
import {decideAoEnterprise} from './ao-enterprise-policy.mjs';
const tool={id:'ao.read',version:'1.0.0',owner:'TEBE',risk:'read',transport:'tebe_api',enabled:true};
const task={version:'1.0.0',requestId:'req-12345678',taskId:'task-12345678',toolId:tool.id,tenantId:'tenant-a',principalId:'user-a',intent:{}};
const principal={authenticated:true,active:true,id:'user-a',tenantId:'tenant-a'};
const grant={verifiedByServer:true,entitled:true,roleAuthorized:true,tenantId:'tenant-a',principalId:'user-a',toolIds:['ao.read']};
const run=overrides=>decideAoEnterprise({enabled:true,tool,task,principal,grant,...overrides});
test('disabled by default',()=>assert.equal(decideAoEnterprise({tool,task,principal,grant}).verdict,'DENY'));
test('read-only TEBE policy remains advisory, never authorizes execution',()=>{
 const decision=run();
 assert.equal(decision.verdict,'ELIGIBLE_FOR_REVIEW');
 assert.equal(decision.executionEnabled,false);
 assert.notEqual(decision.verdict,'ALLOW');
});
test('cross-tenant request denied',()=>assert.equal(run({task:{...task,tenantId:'tenant-b'}}).verdict,'DENY'));
test('unauthenticated principal denied',()=>assert.equal(run({principal:{...principal,authenticated:false}}).verdict,'DENY'));
test('unverified grant denied',()=>assert.equal(run({grant:{...grant,verifiedByServer:false}}).verdict,'DENY'));
test('unentitled principal denied',()=>assert.equal(run({grant:{...grant,entitled:false}}).verdict,'DENY'));
test('unlisted tool denied',()=>assert.equal(run({grant:{...grant,toolIds:['other.tool']}}).verdict,'DENY'));
test('arbitrary task intent denied',()=>assert.equal(run({task:{...task,intent:{url:'http://169.254.169.254/'}}}).verdict,'DENY'));
test('extra task claims denied',()=>assert.equal(run({task:{...task,admin:true}}).verdict,'DENY'));
test('remote transports denied',()=>{for(const transport of ['mcp_http','mcp_stdio','native'])assert.equal(run({tool:{...tool,transport}}).verdict,'DENY')});
test('privileged execution denied',()=>{for(const risk of ['external_write','privileged'])assert.equal(run({tool:{...tool,risk}}).verdict,'DENY')});
test('reversible writes never execute without reviewed implementation',()=>{
 assert.equal(run({tool:{...tool,risk:'reversible_write'}}).verdict,'ASK');
 const approval={verdict:'ALLOW',requestId:task.requestId,toolId:tool.id,policyVersion:'1.0.0',
 verifiedByServer:true,approvedByHuman:true,tenantId:'tenant-a',principalId:'user-a',approvedBy:'reviewer-b',approvalId:'grant-12345678'};
 assert.equal(run({tool:{...tool,risk:'reversible_write'},task:{...task,approvalId:approval.approvalId},approval}).verdict,'DENY');
 assert.equal(run({tool:{...tool,risk:'reversible_write'},task:{...task,approvalId:approval.approvalId},approval:{...approval,approvedBy:'user-a'}}).verdict,'ASK');
});
test('artifact refs and out-of-range timeouts denied',()=>{
 assert.equal(run({task:{...task,artifactRefs:['private-artifact']}}).verdict,'DENY');
 assert.equal(run({tool:{...tool,timeoutMs:120001}}).verdict,'DENY');
});

test('inherited and accessor-backed AO tool/task claims denied',()=>{
 const inheritedTool=Object.create(tool);
 assert.equal(run({tool:inheritedTool}).verdict,'DENY');
 const inheritedIntent=Object.create({url:'https://example.invalid'});
 assert.equal(run({task:{...task,intent:inheritedIntent}}).verdict,'DENY');
 const accessorTool={...tool};
 Object.defineProperty(accessorTool,'id',{enumerable:true,get(){return tool.id}});
 assert.equal(run({tool:accessorTool}).verdict,'DENY');
 const symbolTool={...tool,[Symbol('hidden')]:'extra'};
 assert.equal(run({tool:symbolTool}).verdict,'DENY');
});

test('every risk and transport decision remains non-executable even with caller-supplied approval',()=>{
 for(const transport of ['native','mcp_stdio','mcp_http','tebe_api'])for(const risk of ['read','reversible_write','external_write','privileged']){
  const result=run({tool:{...tool,transport,risk,requiresApproval:false}});
  assert.equal(result.executionEnabled,false,`${transport}/${risk}`);
  assert.notEqual(result.verdict,'ALLOW',`${transport}/${risk}`);
 }
});
