import test from 'node:test';
import assert from 'node:assert/strict';
import { observePublicReadiness, renderSummary, TARGETS } from './public-domain-readiness.mjs';

const yes = async () => ['192.0.2.1'];
const no = async () => { throw new Error('private DNS resolver diagnostics'); };
const get = async () => ({ status: 200, body: { cancel: async () => {} } });
const base = { dns4: yes, dns6: no, dnsNs: yes, dnsMx: yes, request: get,
  now: () => '2026-11-03T17:00:00.000Z' };

test('healthy fixed targets are connectivity-only, never customer launch approval', async () => {
  const r = await observePublicReadiness(base);
  assert.equal(TARGETS.length, 3);
  assert.equal(r.reachable, true);
  assert.equal(r.paidCustomerLaunchAccepted, false);
  assert.equal(r.deployedShaVerified, false);
  assert.equal(r.mailDeliveryVerified, false);
  assert.equal(r.targets.length, 3);
  assert.ok(r.targets.every(t => t.httpsStatus === 200 && t.dnsResolves));
});

test('DNS outage fails closed without attempting HTTPS', async () => {
  let calls = 0;
  const r = await observePublicReadiness({ ...base, dns4: no, dns6: no,
    request: async () => { calls++; throw Error('should never be called'); } });
  assert.equal(r.reachable, false);
  assert.equal(calls, 0);
  assert.ok(r.targets.every(x => !x.dnsResolves && x.httpsStatus === null));
});

test('auth redirects count as reachability but 4xx and 5xx do not', async () => {
  const redirect = await observePublicReadiness({ ...base, request: async () => ({ status: 302 }) });
  assert.equal(redirect.reachable, true);
  for (const status of [401, 403, 404, 500, 502]) {
    const r = await observePublicReadiness({ ...base, request: async () => ({ status }) });
    assert.equal(r.reachable, false, 'status ' + status);
  }
});

test('network errors never leak sensitive host or provider diagnostics', async () => {
  const r = await observePublicReadiness({ ...base,
    request: async () => { throw Error('Bearer sk_test_sensitive'); } });
  const summary = renderSummary(r);
  assert.equal(r.reachable, false);
  assert.doesNotMatch(summary, /sk_test_sensitive|Bearer/);
  assert.match(summary, /Paid-customer launch accepted: NO/);
});

test('missing MX records do not masquerade as proof of mail delivery', async () => {
  const r = await observePublicReadiness({ ...base, dnsMx: no });
  assert.equal(r.reachable, true);
  assert.equal(r.mxLookupPresent, false);
  assert.equal(r.mailDeliveryVerified, false);
});

test('no nameserver records prevents a public-ready determination', async () => {
  const r = await observePublicReadiness({ ...base, dnsNs: no });
  assert.equal(r.reachable, false);
});
