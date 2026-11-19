// Independent GIZE AO v1 admission policy. SOURCE-ONLY; do not mount or execute tools.
// Caller MUST load actor, registry, entitlement and approval from trusted server storage.
// An ALLOW decision is not an execution grant: executionSupported is always false.
const ID = /^[a-z][a-z0-9_.-]{2,79}$/;
const SUBJECT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const NONCE = /^[A-Za-z0-9_-]{16,128}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const RISK = new Set(['read', 'reversible_write', 'external_write', 'privileged']);
const TRANSPORT = new Set(['tebe_api', 'native', 'mcp_stdio', 'mcp_http']);
const decision = (verdict, reason) => Object.freeze({verdict, reason, executionSupported: false, policyVersion:'ao-tebe-v1'});
const deny = reason => decision('DENY', reason);
// Approval evidence must be a dense list of bounded strings. Array#every
// skips holes, so sparse arrays and extra properties must be rejected.
const validEvidenceRefs = refs => {
  if (!Array.isArray(refs) || refs.length < 1 || refs.length > 32) return false;
  if (Reflect.ownKeys(refs).length !== refs.length + 1) return false;
  for (let i = 0; i < refs.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(refs, i);
    if (!descriptor || descriptor.enumerable !== true ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
        typeof descriptor.value !== 'string' ||
        descriptor.value.length < 1 || descriptor.value.length > 256) return false;
  }
  return true;
};
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
// Reject hidden/symbol fields and accessor-backed inputs, not just enumerable JSON keys.
// Otherwise a forged "exact" security object can smuggle unreviewed properties.
const exact = (x, keys) => plain(x) && Reflect.ownKeys(x).every(k => {
  if (typeof k !== 'string' || !keys.includes(k)) return false;
  const descriptor = Object.getOwnPropertyDescriptor(x, k);
  return descriptor !== undefined && descriptor.enumerable === true &&
    Object.prototype.hasOwnProperty.call(descriptor, 'value');
});
const safeHttpsEndpoint = value => {
  if (typeof value !== 'string' || value.length > 512) return false;
  try {
    const u = new URL(value);
    // No discovery endpoints, localhost, redirects or credentials trusted by this policy.
    const host = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash ||
        u.port || u.href !== value || !host.includes('.') ||
        host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
        host.endsWith('.internal') || /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
        host.includes(':') || host.endsWith('.test') || host.endsWith('.invalid')) return false;
    return true;
  } catch { return false; }
};
/** Deny-first, no side effects. All flags/registries must be DB-backed and freshly verified.
 * An AO approval may be recorded for review, but is NOT an executable grant.
 */
function evaluateAoEnterpriseCallInternal({enabled=false, tool, task, actor, registry, approval}={}) {
  if (enabled !== true) return deny('disabled');
  if (!exact(tool,['id','version','owner','risk','transport','enabled','requiresApproval','timeoutMs','endpoint']) ||
      !ID.test(tool.id ?? '') || tool.version !== '1.0.0' || tool.owner !== 'TEBE' ||
      !RISK.has(tool.risk) || !TRANSPORT.has(tool.transport) || tool.enabled !== true ||
      (tool.requiresApproval !== undefined && typeof tool.requiresApproval !== 'boolean') ||
      (tool.timeoutMs !== undefined && (!Number.isSafeInteger(tool.timeoutMs) ||
        tool.timeoutMs < 100 || tool.timeoutMs > 120000))) return deny('tool_invalid');
  if (!exact(task,['version','requestId','taskId','toolId','tenantId','principalId','intent','approvalId','artifactRefs']) ||
      task.version !== '1.0.0' || !NONCE.test(task.requestId ?? '') || !NONCE.test(task.taskId ?? '') ||
      task.toolId !== tool.id || !UUID.test(task.tenantId ?? '') || !SUBJECT.test(task.principalId ?? '') ||
      !plain(task.intent) || Reflect.ownKeys(task.intent).length !== 0 ||
      (task.artifactRefs !== undefined && (!Array.isArray(task.artifactRefs) || task.artifactRefs.length !== 0))) return deny('task_invalid');
  if (!exact(actor,['authenticated','principalId','tenantId','active','tenantMember','entitled','allowedToolIds','roles','serverVerified']) ||
      actor.serverVerified !== true || actor.authenticated !== true || actor.active !== true || actor.tenantMember !== true || actor.entitled !== true ||
      actor.principalId !== task.principalId || actor.tenantId !== task.tenantId ||
      !Array.isArray(actor.allowedToolIds) || !actor.allowedToolIds.includes(tool.id) ||
      !Array.isArray(actor.roles) || !actor.roles.includes('ao_operator')) return deny('unauthorized_principal');
  if (!exact(registry,['tenantId','enabled','toolIds','allowedHttpsEndpoints','serverVerified','revision']) ||
      registry.serverVerified !== true || registry.enabled !== true || registry.tenantId !== task.tenantId ||
      !Number.isSafeInteger(registry.revision) || registry.revision < 1 ||
      !Array.isArray(registry.toolIds) || !registry.toolIds.includes(tool.id) ||
      !Array.isArray(registry.allowedHttpsEndpoints)) return deny('untrusted_tenant_registry');
  // No arbitrary executable host/STDIO/native process path may be approved by this module.
  if (tool.transport === 'native' || tool.transport === 'mcp_stdio') return deny('transport_not_integrated');
  if (tool.transport === 'mcp_http') {
    if (!safeHttpsEndpoint(tool.endpoint) ||
        !registry.allowedHttpsEndpoints.includes(tool.endpoint)) return deny('endpoint_not_pinned');
    // TLS/OAuth audience, DNS pinning and egress still require a dedicated transport executor.
    return deny('mcp_http_executor_not_integrated');
  }
  if (tool.endpoint !== undefined) return deny('unexpected_endpoint');
  if (tool.risk !== 'read' || tool.requiresApproval === true) {
    if (!exact(approval,['requestId','toolId','tenantId','principalId','verdict','approvedBy','policyVersion','serverVerified','expiresAt','evidenceRefs']) ||
        approval.serverVerified !== true || approval.verdict !== 'ALLOW' ||
        approval.requestId !== task.requestId || approval.toolId !== tool.id ||
        approval.tenantId !== task.tenantId || approval.principalId !== task.principalId ||
        !SUBJECT.test(approval.approvedBy ?? '') || approval.approvedBy === task.principalId ||
        approval.policyVersion !== 'ao-tebe-v1' || !validEvidenceRefs(approval.evidenceRefs) ||
        !Number.isSafeInteger(approval.expiresAt) ||
        approval.expiresAt <= Math.floor(Date.now()/1000)) return decision('ASK','human_approval_required');
    // A signature/assertion from a caller is never enough for privileged execution.
    return deny('privileged_executor_not_integrated');
  }
  return decision('ALLOW','admissible_read_only');
}

// Untrusted plugin input must never escape as an exception or become an execution grant.
export function evaluateAoEnterpriseCall(input) {
  try {
    if (input !== undefined && !plain(input)) return deny('malformed_request');
    return evaluateAoEnterpriseCallInternal(input);
  } catch {
    return deny('malformed_request');
  }
}
