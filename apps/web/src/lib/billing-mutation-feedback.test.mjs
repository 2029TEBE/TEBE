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
test('browser billing mutations reject unsafe requests and fail closed',()=>{
 for(const route of ['checkout','subscription']){
  const source=readFileSync(new URL('../app/api/billing/'+route+'/route.ts',import.meta.url),'utf8');
  assert.match(source,/rejectUnsafeBrowserMutation\(req\)/);
  assert.match(source,/status: 503/);
  assert.doesNotMatch(source,/fetchTenantMutation|response\.redirected|req\.formData\(/);
 }
});
test('Paddle UI provides bilingual status without propagating raw errors',()=>{
 const source=readFileSync(new URL('../app/(app)/billing/page.tsx',import.meta.url),'utf8');
 assert.match(source,/Paddle is our billing provider/);
 assert.match(source,/Paddle هو مزود الفوترة/);
 assert.doesNotMatch(source,/\{error\}/);
});
