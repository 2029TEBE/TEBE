import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
const callback = source.slice(source.indexOf('async completeConnect('), source.indexOf('async disconnect('));
assert.ok(callback.startsWith('async completeConnect('), 'OAuth callback must exist');

test('E49 rejects mismatched tenant, unknown provider and missing state actor before token exchange', () => {
  const stateCheck = callback.indexOf('st.tenant_id !== tenantId');
  const providerCheck = callback.indexOf("st.provider !== 'microsoft:graph'");
  const actorCheck = callback.indexOf("typeof st.user_id !== 'string'");
  const exchange = callback.indexOf('tok = await exchangeCode(cfg, code, resource)');
  assert.ok(stateCheck > 0 && providerCheck > stateCheck && actorCheck > providerCheck);
  assert.ok(exchange > actorCheck, 'state must be validated before provider exchange');
  assert.match(callback.slice(stateCheck, exchange), /throw new BadRequestException/);
  assert.doesNotMatch(callback.slice(stateCheck, exchange), /console\.(?:log|error)|this\.log\.log/);
});

test('E49 rejects disabled users and inactive/downgraded administrators before Microsoft token exchange', () => {
  const preflight = callback.indexOf('const [eligible]');
  const exchange = callback.indexOf('tok = await exchangeCode(cfg, code, resource)');
  assert.ok(preflight > 0 && preflight < exchange);
  const guard = callback.slice(preflight, exchange);
  assert.match(guard, /JOIN users AS u ON u\.id = m\.user_id/);
  assert.match(guard, /m\.tenant_id = \$\{tenantId\} AND m\.user_id = \$\{st\.user_id\}/);
  assert.match(guard, /m\.is_active = true AND u\.is_active = true/);
  assert.match(guard, /m\.role IN \('owner', 'admin', 'client_admin'\)/);
  assert.match(guard, /if \(!eligible\)[\s\S]*?throw new ForbiddenException/);
});

test('E49 locks both active user and administrator membership during credential persistence', () => {
  const exchange = callback.indexOf('tok = await exchangeCode(cfg, code, resource)');
  const commit = callback.indexOf('const [authorized]', exchange);
  const upsert = callback.indexOf('INSERT INTO integration_connections', commit);
  assert.ok(commit > exchange && upsert > commit);
  const locked = callback.slice(commit, upsert);
  assert.match(locked, /JOIN users AS u ON u\.id = m\.user_id/);
  assert.match(locked, /m\.is_active = true AND u\.is_active = true/);
  assert.match(locked, /FOR SHARE OF m, u/);
  assert.match(locked, /if \(!authorized\)[\s\S]*?throw new ForbiddenException/);
});

test('E49 retains single-use state and same-owner conflict protection', () => {
  assert.match(callback, /DELETE FROM oauth_states[\s\S]*?expires_at > now\(\)[\s\S]*?RETURNING tenant_id, provider, user_id, return_to/);
  assert.match(callback, /WHERE integration_connections\.connected_by = EXCLUDED\.connected_by/);
  assert.match(callback, /this\.invalidateTenantTokens\(tenantId\)/);
});
