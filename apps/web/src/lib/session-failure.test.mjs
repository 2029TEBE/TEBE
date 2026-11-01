import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sessionFailureKind } from './session-failure.mjs';

test('only explicit auth refusals classify a session as signed out', () => {
  assert.equal(sessionFailureKind(401), 'signed-out');
  assert.equal(sessionFailureKind(403), 'signed-out');
  for (const status of [null, undefined, 0, 404, 429, 500, 502, 503, 504, '401']) {
    assert.equal(sessionFailureKind(status), 'unavailable');
  }
});

test('authenticated layout uses strict session lookup, not the login-page fallback', () => {
  const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../app/(app)/layout.tsx', import.meta.url), 'utf8');
  assert.match(api, /export async function getLayoutSession\(/);
  assert.match(api, /sessionFailureKind\(status\)/);
  assert.match(layout, /await getLayoutSession\(\)/);
  assert.match(layout, /'unavailable' in session/);
  assert.match(layout, /role="alert"/);
  assert.match(layout, /redirect\(ended \? '\/login\?error=expired' : '\/login'\)/);
});

test('login page does not ask for credentials during session-verification outages', () => {
  const login = readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
  assert.match(login, /import \{ getLayoutSession \} from '@\/lib\/api'/);
  assert.match(login, /const s = await getLayoutSession\(\)/);
  assert.doesNotMatch(login, /await getSession\(\)/);
  const guard = login.indexOf("if ('unavailable' in s && s.unavailable)");
  const form = login.indexOf('<form className="authform"');
  assert.ok(guard >= 0 && form > guard, 'outage branch must precede credential form');
  assert.match(login, /Session verification unavailable/);
  assert.match(login, /تعذّر التحقق من الجلسة/);
  assert.match(login, /You have not been signed out/);
  assert.match(login, /role="alert"/);
  assert.match(login, /href="\/login"/);
});
