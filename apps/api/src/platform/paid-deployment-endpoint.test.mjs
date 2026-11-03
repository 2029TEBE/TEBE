import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaidDeploymentEndpoint } from './paid-deployment-endpoint.mjs';

const principal = { authenticated: true, userId: 'user-1', tenantId: 'tenant-1' };
const valid = () => ({ verified: true, active: true, revoked: false,
  tenantId: principal.tenantId, expiresAtMs: Date.now() + 60000 });
async function invoke(verifyEntitlement, request = { headers: { 'x-tenant-id': 'attacker', 'x-paid': 'true' } }) {
  let dbQueries = 0;
  const endpoint = createPaidDeploymentEndpoint({
    db: { query: async () => { dbQueries++; throw Error('database must not be reached'); } },
    approvedOrigins: [], authenticate: async () => principal, verifyEntitlement
  });
  const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; },
    end(body) { this.body = JSON.parse(body); } };
  await endpoint(request, response);
  return { response, dbQueries };
}
test('rejects missing, unsigned, expired, revoked and foreign tenant entitlements before database access', async () => {
  const invalid = [null, { ...valid(), verified: false }, { ...valid(), active: false },
    { ...valid(), revoked: true }, { ...valid(), tenantId: 'other' },
    { ...valid(), expiresAtMs: Date.now() - 1000 },
    { ...valid(), expiresAtMs: '9999999999999' }];
  for (const entitlement of invalid) {
    const { response, dbQueries } = await invoke(async () => entitlement);
    assert.equal(response.statusCode, 401);
    assert.equal(dbQueries, 0);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.deepEqual(response.body, { error: 'Unauthorized' });
  }
});
test('server-owned identity is passed to verifier, not spoofed request headers', async () => {
  let args;
  const { response } = await invoke(async input => { args = input; return valid(); });
  assert.deepEqual(args, { userId: principal.userId, tenantId: principal.tenantId });
  assert.equal(response.statusCode, 403); // DB intentionally fails closed
  assert.deepEqual(response.body, { error: 'Deployment unavailable' });
});
test('verifier exceptions fail closed without leaking internal error', async () => {
  const { response, dbQueries } = await invoke(async () => { throw Error('secret billing token'); });
  assert.equal(response.statusCode, 403);
  assert.equal(dbQueries, 0);
  assert.doesNotMatch(JSON.stringify(response.body), /secret|token/i);
});
test('missing verifier is rejected at construction', () => {
  assert.throws(() => createPaidDeploymentEndpoint({
    db: {}, approvedOrigins: [], authenticate: async () => principal
  }), /configuration invalid/);
});
