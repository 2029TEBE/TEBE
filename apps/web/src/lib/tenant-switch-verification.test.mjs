import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tenantSwitchAcknowledged, classifyTenantSwitch401 } from './tenant-switch-verification.mjs';

const target = '00000000-0000-4000-8000-000000000002';
const active = '00000000-0000-4000-8000-000000000001';
const cookie = 'pmo_session=synthetic-opaque';
const endpoint = 'https://api.theepmo.com/auth/session';
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});
const session = (ids = [active]) => ({
  authenticated: true, userId: 'user-synthetic', email: 'synthetic@example.test',
  displayName: 'Synthetic', tenantId: active, tenantName: 'Workspace A',
  role: 'owner', capabilities: ['pmoa_admin'],
  tenants: ids.map(id => ({ tenantId: id, name: id, slug: 'synthetic', role: 'owner' })),
});

test('switch requires bounded JSON {ok:true}, not an HTTP 200 HTML page or false acknowledgement', async () => {
  assert.equal(await tenantSwitchAcknowledged(json({ok:true})), true);
  for (const res of [
    new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    json({ok:false}), json({ok:'true'}), json([]),
    new Response('{bad', { status: 200, headers: { 'content-type': 'application/json' } }),
    new Response(null, { status: 204 }), json({ok:true}, 401),
    new Response(JSON.stringify({ok:true,pad:'x'.repeat(5000)}), { headers: { 'content-type': 'application/json' } }),
  ]) assert.equal(await tenantSwitchAcknowledged(res), false);
});

test('a 401 for nonmembership is classified as permission denied using one safe session read', async () => {
  let calls = 0;
  const result = await classifyTenantSwitch401(async (url, init) => {
    calls++;
    assert.equal(url, endpoint);
    assert.equal(init.method, 'GET');
    assert.equal(init.headers.cookie, cookie);
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    return json(session());
  }, endpoint, cookie, target);
  assert.equal(result, 403);
  assert.equal(calls, 1);
});

test('expired and signed-out sessions remain 401, never permission success', async () => {
  for (const response of [json({authenticated:false}), json({}, 401)]) {
    assert.equal(await classifyTenantSwitch401(async () => response, endpoint, cookie, target), 401);
  }
});

test('ambiguous, malformed, oversized and redirecting session reads fail closed', async () => {
  for (const response of [
    json(session([active, target])), json({authenticated:true}),
    new Response('<html>login</html>', {headers:{'content-type':'text/html'}}),
    json({authenticated:false, pad:'x'.repeat(66000)}),
    new Response(null,{status:503}),
  ]) assert.equal(await classifyTenantSwitch401(async () => response, endpoint, cookie, target), null);
  assert.equal(await classifyTenantSwitch401(async () => { throw new Error('redirect'); }, endpoint, cookie, target), null);
});

test('session switch route enforces acknowledgement and 401 classification before landing redirect', () => {
  const source = readFileSync(new URL('../app/api/session/tenant/route.ts', import.meta.url), 'utf8');
  assert.match(source, /classifyTenantSwitch401\(fetch, \`\$\{BASE\}\/auth\/session\`,/);
  assert.match(source, /tenantSwitchAcknowledged\(response\)/);
  assert.match(source, /tenantSwitchFailurePath\(classified\)/);
  assert.match(source, /tenantSwitchFailurePath\(null\)/);
  assert.doesNotMatch(source, /response\.json\(\)/);
});
