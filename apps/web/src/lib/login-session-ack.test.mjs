import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifiedLoginSessionToken } from './login-session-ack.mjs';

const token = 'A'.repeat(43);
const tenant = { tenantId: '11111111-1111-4111-8111-111111111111', name: 'Synthetic workspace', slug: 'synthetic', role: 'owner' };
const valid = { ok: true, tenants: [tenant] };
function reply(status = 200, body = valid, type = 'application/json; charset=utf-8', cookie = `pmo_session=${token}; HttpOnly; Path=/`) {
  const headers = { 'content-type': type };
  if (cookie !== null) headers['set-cookie'] = cookie;
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
}

test('only the exact API acknowledgement and a single 43-character token can sign in', async () => {
  assert.equal(await verifiedLoginSessionToken(reply()), token);
  assert.equal(await verifiedLoginSessionToken(reply(200, { ok: true, tenants: [] })), null);
  assert.equal(await verifiedLoginSessionToken(reply(200, { ok: false, tenants: [tenant] })), null);
  assert.equal(await verifiedLoginSessionToken(reply(200, { ok: true, tenants: [{ ...tenant, tenantId: 'foreign' }] })), null);
});

test('HTML, malformed, oversized and false-success HTTP 200 responses cannot install a session', async () => {
  for (const res of [
    reply(200, '<html>Sign in</html>', 'text/html'), reply(200, '{bad-json'),
    reply(200, { ok: true }), reply(200, valid, 'text/plain'),
    reply(200, 'x'.repeat(65_537)), reply(401, valid), reply(503, valid),
    reply(200, valid, 'application/json', null),
    reply(200, valid, 'application/json', 'pmo_session=short; HttpOnly'),
  ]) assert.equal(await verifiedLoginSessionToken(res), null);
});

test('duplicate, injected and redirect-marked session responses fail closed', async () => {
  const duplicate = reply();
  Object.defineProperty(duplicate.headers, 'getSetCookie', { value: () => [
    `pmo_session=${token}; HttpOnly`, `pmo_session=${'B'.repeat(43)}; HttpOnly`,
  ] });
  assert.equal(await verifiedLoginSessionToken(duplicate), null);
  const injected = reply();
  Object.defineProperty(injected.headers, 'getSetCookie', { value: () => [`pmo_session=${token}\r\nInjected: yes`] });
  assert.equal(await verifiedLoginSessionToken(injected), null);
  const redirected = reply();
  Object.defineProperty(redirected, 'redirected', { value: true });
  assert.equal(await verifiedLoginSessionToken(redirected), null);
});

test('login route must use verified acknowledgement before writing the session cookie', () => {
  const source = readFileSync(new URL('../app/api/session/route.ts', import.meta.url), 'utf8');
  assert.match(source, /verifiedLoginSessionToken\(res\)/);
  assert.doesNotMatch(source, /getSetCookie\?\.\(\)/);
  assert.match(source, /if \(!token\) return back\('session_missing'\)/);
});
