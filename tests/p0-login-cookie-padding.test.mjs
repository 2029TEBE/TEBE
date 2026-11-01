import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../apps/web/src/app/api/session/route.ts', import.meta.url), 'utf8');
const helper = readFileSync(new URL('../apps/web/src/lib/login-session-ack.mjs', import.meta.url), 'utf8');

test('login validates the current opaque base64url token without truncating cookie values', () => {
  // The API creates a 32-byte random base64url token (43 characters, no padding).
  // Do not split on '=': cookie extraction is bounded by the first semicolon.
  assert.match(route, /verifiedLoginSessionToken\(res\)/);
  assert.ok(helper.includes("split(';', 1)[0].slice(`\${SESSION}=`.length)"));
  assert.ok(helper.includes('const TOKEN = /^[A-Za-z0-9_-]{43}$/;'));
  assert.doesNotMatch(helper, /split\('= '\)\[1\]/);
});

test('login refuses to create a session from a missing or unverified token', () => {
  assert.match(route, /if \(!token\) return back\('session_missing'\)/);
  assert.match(route, /httpOnly: true/);
});
