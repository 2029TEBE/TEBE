import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const signup = readFileSync(new URL('../app/signup/page.tsx', import.meta.url), 'utf8');
const login = readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');

test('public access page explicitly distinguishes invitation requests from self-service signup', () => {
  assert.match(signup, /invitation-only/);
  assert.match(signup, /Self-service registration and first-subscription checkout are not available yet/);
  assert.match(signup, /info@theepmo\.com/);
  assert.match(signup, /mailto:info@theepmo\.com\?subject=/);
  assert.match(signup, /getLang\(\)/);
  assert.match(signup, /'rtl'/);
  assert.match(signup, /طلب الوصول إلى مساحة عمل/);
});

test('login provides a discoverable access request without creating accounts or subscriptions', () => {
  assert.match(login, /<Link href="\/signup">/);
  assert.match(signup, /<Link href="\/login">/);
  assert.match(signup, /<Link href="\/forgot-password">/);
  assert.doesNotMatch(signup, /<form[\s>]/);
  assert.doesNotMatch(signup, /fetch\(|POST\(|subscription\.status\s*=|setCookie\(/);
  assert.match(signup, /server verifies the subscription/);
});
