import test from "node:test";
import assert from "node:assert/strict";
import { createTenantCodeModeDiscovery } from "../apps/api/src/ao/gize-code-mode-admission.mjs";
const descriptions = [
  { id: "gize.projects.read", description: "Read project summary" },
  { id: "gize.billing.read", description: "Read billing summary" }
];
const principal = { authenticated: true, active: true, id: "user-123", tenantId: "tenant-a" };
test("discovery is disabled without trusted middleware", async () => {
  const gateway = createTenantCodeModeDiscovery({ descriptions });
  assert.equal((await gateway.search({ query: "read" }, {})).ok, false);
  assert.equal((await gateway.execute({ code: "anything" })).ok, false);
});
test("authenticated discovery is filtered by server capability", async () => {
  const gateway = createTenantCodeModeDiscovery({
    descriptions,
    resolveServerPrincipal: async request => request.serverPrincipal,
    allowCapability: async ({ principal: p, tool }) =>
      p.tenantId === "tenant-a" && tool.id === "gize.projects.read"
  });
  const result = await gateway.search({ query: "read", limit: 10 },
    { serverPrincipal: principal });
  assert.equal(result.ok, true);
  assert.equal(result.available, false);
  assert.deepEqual(result.tools.map(tool => tool.id), ["gize.projects.read"]);
  assert.equal((await gateway.execute()).reason,
    "execution_disabled_pending_tenant_security_review");
});
test("cross tenant, untrusted or missing principals receive no catalog", async () => {
  const gateway = createTenantCodeModeDiscovery({
    descriptions,
    resolveServerPrincipal: async request => request.serverPrincipal,
    allowCapability: async ({ principal: p }) => p.tenantId === "tenant-a"
  });
  for (const bad of [
    { ...principal, tenantId: "tenant-b" },
    { ...principal, authenticated: false },
    Object.create(principal),
    null
  ]) {
    const result = await gateway.search({ query: "read" }, { serverPrincipal: bad });
    assert.ok(!result.ok || result.tools.length === 0);
  }
});
test("malformed discovery queries and descriptions fail closed", async () => {
  assert.throws(() => createTenantCodeModeDiscovery({
    descriptions: [descriptions[0], descriptions[0]]
  }));
  const gateway = createTenantCodeModeDiscovery({
    descriptions, resolveServerPrincipal: async () => principal,
    allowCapability: async () => true
  });
  assert.equal((await gateway.search({ query: "x" }, {})).ok, false);
  assert.equal((await gateway.search({ query: "read", limit: 1000 }, {})).ok, false);
});
