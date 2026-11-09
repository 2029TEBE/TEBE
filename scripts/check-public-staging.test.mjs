import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPublicStaging, TARGETS } from './check-public-staging.mjs';

const response = (contentType, body, status = 200) => ({
  status,
  headers: { get: name => name === 'content-type' ? contentType : null },
  json: async () => body,
});
const ok = {
  dns: async () => 1,
  request: async url => url === TARGETS.api.url
    ? response('application/json', { ok: true, service: 'pmo-api' })
    : response('text/html', null),
};
test('fixed targets are staging-only URLs', () => {
  assert.deepEqual(Object.keys(TARGETS), ['web','api']);
  for (const target of Object.values(TARGETS)) {
    assert.match(target.host, /^(?:api-)?staging\.theepmo\.com$/);
    assert.equal(new URL(target.url).hostname, target.host);
  }
});
test('public staging readiness needs DNS and explicit expected identity', async () => {
  const result = await checkPublicStaging(ok);
  assert.equal(result.passed, true);
  assert.equal(result.results.length, 4);
});
test('missing DNS blocks both endpoints and avoids HTTP calls', async () => {
  let called = false;
  const result = await checkPublicStaging({
    dns: async () => { throw Error('ENOTFOUND'); },
    request: async () => { called = true; throw Error('should not be invoked'); },
  });
  assert.equal(result.passed, false);
  assert.equal(called, false);
  assert.equal(result.results.filter(x => !x.passed).length, 4);
});
test('redirects and non-200 responses cannot be treated as healthy', async () => {
  const result = await checkPublicStaging({ dns: ok.dns, request: async () => response('text/html',null,302) });
  assert.equal(result.passed, false);
});
test('production or mismatched API health identity fails', async () => {
  const result = await checkPublicStaging({
    ...ok,
    request: async url => url === TARGETS.api.url
      ? response('application/json',{ok:true,service:'production-api'})
      : response('text/html', null),
  });
  assert.equal(result.passed, false);
  assert.ok(result.results.some(x => x.service === 'api' && x.gate === 'HTTPS identity' && !x.passed));
});
test('a staging login redirect is not proof of the staging web app', async () => {
  const result = await checkPublicStaging({
    ...ok,
    request: async url => url === TARGETS.web.url
      ? response('text/plain', null)
      : response('application/json',{ok:true,service:'pmo-api'}),
  });
  assert.equal(result.passed, false);
});
