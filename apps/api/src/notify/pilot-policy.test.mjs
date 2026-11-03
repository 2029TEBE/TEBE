import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceWelcome } from './pilot-policy.ts';

test('welcome messages guide both languages to sign-in without exposing project details', () => {
  for (const lang of ['en', 'ar']) {
    const result = workspaceWelcome('https://app.theepmo.com/path?token=not-forwarded', lang);
    assert.match(result.body, /https:\/\/app.theepmo.com\//);
    assert.equal(result.body.includes('not-forwarded'), false);
    assert.ok(result.subject.length > 0);
  }
});
test('welcome rejects credentialed, insecure and executable destinations', () => {
  for (const origin of ['http://app.theepmo.com','https://user:password@app.theepmo.com','javascript:alert(1)']) {
    assert.throws(() => workspaceWelcome(origin, 'en'));
  }
});
