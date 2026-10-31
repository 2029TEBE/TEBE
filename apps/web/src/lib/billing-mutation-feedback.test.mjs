import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { billingFailurePath, billingFailureText } from './billing-mutation-feedback.mjs';

test('401 never appears as a completed billing mutation', () => {
  assert.equal(billingFailurePath(401), '/login?error=expired');
  for (const status of [403, 409, 429, 500, 503, undefined, 0, 400]) {
    assert.match(billingFailurePath(status), /^\/billing\?error=(forbidden|conflict|rate_limited|unavailable|failed)$/);
    assert.notEqual(billingFailurePath(status), '/billing?updated=1');
  }
});
test('known errors have distinct English and Arabic guidance without raw upstream text', () => {
  assert.equal(billingFailurePath(403), '/billing?error=forbidden');
  assert.equal(billingFailurePath(409), '/billing?error=conflict');
  assert.equal(billingFailurePath(429), '/billing?error=rate_limited');
  assert.equal(billingFailurePath(504), '/billing?error=unavailable');
  for (const code of ['forbidden', 'conflict', 'rate_limited', 'unavailable', 'failed']) {
    const en = billingFailureText(code, 'en');
    const ar = billingFailureText(code, 'ar');
    assert.ok(en.length > 25 && ar.length > 25);
    assert.notEqual(en, ar);
  }
  assert.equal(billingFailureText('https://evil.test/?cookie=secret'), billingFailureText('failed'));
  assert.equal(billingFailureText('__proto__'), billingFailureText('failed'));
});
test('both browser billing mutations use bounded forms and non-replaying upstream deadline', () => {
  for (const path of ['checkout', 'subscription']) {
    const source = readFileSync(new URL('../app/api/billing/' + path + '/route.ts', import.meta.url), 'utf8');
    assert.match(source, /rejectUnsafeBrowserMutation\(req\)/);
    assert.match(source, /readBoundedBrowserForm\(req, 16_384\)/);
    assert.match(source, /fetchTenantMutation\(fetch,/);
    assert.match(source, /billingFailurePath\(401\)/);
    assert.match(source, /billingFailurePath\(response\?\.status\)/);
    assert.doesNotMatch(source, /req\.formData\(/);
    assert.doesNotMatch(source, /fetch\(\x60\$\{BASE\}/);
  }
});
test('billing UI maps allowlisted localized error feedback', () => {
  const source = readFileSync(new URL('../app/(app)/billing/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /billingFailureText\(error, lang\)/);
  assert.doesNotMatch(source, /\{error\}/);
});
