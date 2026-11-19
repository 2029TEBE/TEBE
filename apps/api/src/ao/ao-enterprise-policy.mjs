// TEBE AO v1 candidate authorization boundary. SOURCE-ONLY, not wired to routes.
// Inputs MUST be derived from trusted server-side authentication, policy and persistence.
// This function does not execute tools or prove supplied evidence is trustworthy.
const TOOL=/^[a-z][a-z0-9_.-]{2,79}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const risks=new Set(['read','reversible_write','external_write','privileged']);
const transports=new Set(['native','mcp_stdio','mcp_http','tebe_api']);
const deny=reason=>Object.freeze({verdict:'DENY',reason,executionEnabled:false});
const ask=reason=>Object.freeze({verdict:'ASK',reason,executionEnabled:false});
const exact=(o,allowed)=>{
 try {
  if(!o||typeof o!=='object'||Array.isArray(o)||Object.getPrototypeOf(o)!==Object.prototype)return false;
  return Reflect.ownKeys(o).every(k=>typeof k==='string'&&allowed.includes(k)&&
   Object.getOwnPropertyDescriptor(o,k)?.get===undefined&&
   Object.getOwnPropertyDescriptor(o,k)?.set===undefined);
 } catch { return false; }
};
const id=x=>typeof x==='string'&&ID.test(x);
export function decideAoEnterprise({enabled=false,tool,task,principal,grant,approval}={}){
 if(enabled!==true)return deny('integration_disabled');
 if(!exact(tool,['id','version','owner','risk','transport','enabled','requiresApproval','timeoutMs'])||
  !TOOL.test(tool.id||'')||tool.version!=='1.0.0'||tool.owner!=='TEBE'||
  !risks.has(tool.risk)||!transports.has(tool.transport)||tool.enabled!==true||
  (tool.timeoutMs!==undefined&&(!Number.isSafeInteger(tool.timeoutMs)||tool.timeoutMs<100||tool.timeoutMs>120000)))
  return deny('invalid_or_disabled_tool');
 if(!exact(task,['version','requestId','taskId','toolId','tenantId','principalId','intent','approvalId','artifactRefs'])||
  task.version!=='1.0.0'||!id(task.requestId)||task.requestId.length<8||
  !id(task.taskId)||task.taskId.length<8||!id(task.tenantId)||!id(task.principalId)||
  task.toolId!==tool.id||!exact(task.intent,[])||
  (task.artifactRefs!==undefined&&(!Array.isArray(task.artifactRefs)||task.artifactRefs.length!==0)))
  return deny('invalid_task_envelope');
 if(!principal||principal.authenticated!==true||principal.active!==true||
  principal.tenantId!==task.tenantId||principal.id!==task.principalId||!id(principal.id))
  return deny('unauthenticated_or_cross_tenant');
 if(!grant||grant.verifiedByServer!==true||grant.tenantId!==task.tenantId||
  grant.principalId!==principal.id||grant.entitled!==true||grant.roleAuthorized!==true||
  !Array.isArray(grant.toolIds)||!grant.toolIds.includes(tool.id))
  return deny('missing_server_authorization');
 // No remote MCP, native process or OS bridge execution until transport, SSRF,
 // DNS rebinding, credential custody and sandbox controls have verified tests.
 if(tool.transport!=='tebe_api')return deny('transport_not_approved');
 if(tool.risk==='external_write'||tool.risk==='privileged')return deny('privileged_tool_not_available');
 if(tool.risk==='reversible_write'||tool.requiresApproval===true){
  if(!approval||approval.verdict!=='ALLOW'||approval.requestId!==task.requestId||
   approval.toolId!==tool.id||approval.policyVersion!=='1.0.0'||approval.verifiedByServer!==true||
   approval.approvedByHuman!==true||approval.tenantId!==task.tenantId||
   approval.principalId!==principal.id||!id(approval.approvedBy)||
   approval.approvedBy===principal.id||!id(task.approvalId)||approval.approvalId!==task.approvalId)
   return ask('independent_human_approval_required');
  return deny('write_execution_not_implemented');
 }
 if(tool.risk!=='read')return deny('unknown_risk');
 // Source-only advisory: caller-provided flags are not server-proven authorization.
 // Never grant execution or return an executable ALLOW verdict from this helper.
 return Object.freeze({verdict:'ELIGIBLE_FOR_REVIEW',reason:'read_requires_server_admission',executionEnabled:false});
}
