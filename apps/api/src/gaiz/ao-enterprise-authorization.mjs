// GIZE AI / AO enterprise authorization preflight. Unmounted, no tool execution.
// Inputs must come from trusted server-side storage, never directly from client JSON.
const deny = reason => Object.freeze({status:'DENY',reason,executionEnabled:false});
const id = x => typeof x==='string'&&x.length>=1&&x.length<=128&&/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(x);
const requestId=x=>id(x)&&x.length>=8;
const toolId=x=>typeof x==='string'&&/^[a-z][a-z0-9_.-]{2,79}$/.test(x);
const risks=new Set(['read','reversible_write','external_write','privileged']);
const owners=new Set(['TEBE']);
const transports=new Set(['native','mcp_stdio','mcp_http','tebe_api']);
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).every(k=>keys.includes(k));

/** Advisory authorization only. Never constitutes an execution grant.
 * A future runtime must independently verify and bind trusted database records,
 * reserve an idempotency key, validate schemas, and append audit evidence.
 */
export function assessAoEnterpriseTask({task,tool,principal,entitlement,approval}={}){
 if(!exact(task,['version','requestId','taskId','toolId','tenantId','principalId','intent','approvalId','artifactRefs'])||
    task.version!=='1.0.0'||!requestId(task.requestId)||!requestId(task.taskId)||
    !toolId(task.toolId)||!id(task.tenantId)||!id(task.principalId)||
    !exact(task.intent,[])||Object.keys(task.intent).length!==0||
    (task.artifactRefs!==undefined&&(!Array.isArray(task.artifactRefs)||task.artifactRefs.length!==0)))
    return deny('invalid_task_contract');
 // Untrusted intent and artifact payloads must not be interpreted here.
 if(!exact(tool,['id','version','owner','risk','transport','enabled','requiresApproval','timeoutMs'])||
    !toolId(tool.id)||tool.version!=='1.0.0'||!owners.has(tool.owner)||
    !risks.has(tool.risk)||!transports.has(tool.transport)||
    tool.enabled!==true||typeof tool.requiresApproval!=='boolean'||
    !Number.isSafeInteger(tool.timeoutMs)||tool.timeoutMs<100||tool.timeoutMs>120000||
    task.toolId!==tool.id) return deny('tool_unavailable');
 if(!exact(principal,['authenticated','serverVerified','tenantId','principalId','active','roles'])||
    principal.authenticated!==true||principal.serverVerified!==true||principal.active!==true||
    !id(principal.tenantId)||!id(principal.principalId)||
    principal.tenantId!==task.tenantId||principal.principalId!==task.principalId||
    !Array.isArray(principal.roles)||principal.roles.length>20||
    !principal.roles.every(id)) return deny('identity_or_tenant_denied');
 if(!exact(entitlement,['serverVerified','tenantId','principalId','allowedToolIds'])||
    entitlement.serverVerified!==true||entitlement.tenantId!==task.tenantId||
    entitlement.principalId!==task.principalId||
    !Array.isArray(entitlement.allowedToolIds)||entitlement.allowedToolIds.length>200||
    !entitlement.allowedToolIds.includes(tool.id)) return deny('entitlement_denied');
 // No remote/native transport or write-capable action can pass this advisory boundary.
 if(tool.transport!=='tebe_api'||tool.risk!=='read') return deny('unsupported_execution_surface');
 if(tool.requiresApproval){
    if(!exact(approval,['serverVerified','requestId','toolId','tenantId','principalId','verdict','approvedBy','policyVersion','approvalId'])||
       approval?.serverVerified!==true||approval.verdict!=='ALLOW'||
       approval.requestId!==task.requestId||approval.toolId!==tool.id||
       approval.tenantId!==task.tenantId||approval.principalId!==task.principalId||
       !id(approval.approvedBy)||approval.approvedBy===task.principalId||
       !id(approval.policyVersion)||!id(task.approvalId)||
       approval.approvalId!==task.approvalId) return deny('human_approval_required');
 }
 return Object.freeze({status:'ELIGIBLE_FOR_REVIEW',reason:'preflight_only',
   requestId:task.requestId,toolId:tool.id,tenantId:task.tenantId,
   executionEnabled:false,requiresDurableReplayReservation:true});
}
