// GIZE enterprise Code Mode discovery candidate.
// SOURCE ONLY: intentionally not registered in NestJS or exposed over HTTP.
// Tenant identity must be resolved by trusted server middleware, never from model input.
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const TOOL = /^[a-z][a-z0-9_.-]{2,79}$/;
const denied = reason => Object.freeze({ ok: false, available: false, reason });
function plain(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype) return false;
    return Reflect.ownKeys(value).every(key => typeof key === "string" &&
      Object.getOwnPropertyDescriptor(value, key)?.get === undefined &&
      Object.getOwnPropertyDescriptor(value, key)?.set === undefined);
  } catch { return false; }
}
function validPrincipal(principal) {
  return plain(principal) && principal.authenticated === true &&
    principal.active === true && ID.test(principal.id || "") &&
    ID.test(principal.tenantId || "");
}
export function createTenantCodeModeDiscovery({
  resolveServerPrincipal, allowCapability, descriptions = []
} = {}) {
  if (!Array.isArray(descriptions) || descriptions.length > 512 ||
    descriptions.some(tool => !plain(tool) || !TOOL.test(tool.id || "") ||
      typeof tool.description !== "string" || tool.description.length > 200))
    throw new TypeError("invalid_code_mode_catalog");
  const tools = descriptions.map(({ id, description }) => Object.freeze({ id, description }));
  if (new Set(tools.map(tool => tool.id)).size !== tools.length)
    throw new TypeError("duplicate_tool_id");
  async function search(request, opaqueServerRequest) {
    if (typeof resolveServerPrincipal !== "function" || typeof allowCapability !== "function")
      return denied("trusted_server_admission_not_configured");
    if (!plain(request) || typeof request.query !== "string" ||
      request.query.trim().length < 2 || request.query.length > 200 ||
      (request.limit !== undefined && (!Number.isInteger(request.limit) ||
        request.limit < 1 || request.limit > 20))) return denied("invalid_search");
    let principal;
    try { principal = await resolveServerPrincipal(opaqueServerRequest); }
    catch { return denied("unauthenticated"); }
    if (!validPrincipal(principal)) return denied("unauthenticated");
    const query = request.query.trim().toLowerCase();
    const results = [];
    for (const tool of tools) {
      if (!(tool.id + " " + tool.description).toLowerCase().includes(query)) continue;
      let allowed = false;
      try { allowed = await allowCapability({ principal, tool }); } catch { allowed = false; }
      if (allowed !== true) continue;
      results.push(tool);
      if (results.length >= (request.limit || 8)) break;
    }
    return { ok: true, available: false, executionSupported: false, tools: results };
  }
  // No generated-code execution or privileged escalation from this source-only helper.
  async function execute() { return denied("execution_disabled_pending_tenant_security_review"); }
  return Object.freeze({ search, execute });
}
