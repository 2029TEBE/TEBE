import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const billing = readFileSync(new URL('../app/(app)/billing/page.tsx', import.meta.url), 'utf8');
const verification = readFileSync(new URL('../app/(app)/billing/verification/page.tsx', import.meta.url), 'utf8');

test('subscription verification is discoverable from authenticated billing', () => {
  assert.match(billing, /<Link href="\/billing\/verification">/);
  assert.match(verification, /getLayoutSession\(\)/);
  assert.match(verification, /pmoa_admin/);
  assert.match(verification, /api\.subscriptionCurrent\(\)/);
  assert.match(verification, /effectiveSubscriptionStatus\(subscription\)/);
  assert.match(verification, /dir=\{ar \? 'rtl' : 'ltr'\}/);
  assert.match(verification, /Session verification unavailable/);
  assert.match(verification, /Subscription verification unavailable/);
});

test('checkout-return markers cannot set entitlement or substitute for server state', () => {
  assert.match(verification, /never.*grants access/i);
  assert.doesNotMatch(verification, /searchParams|localStorage|sessionStorage|fetch\([^\n]*stripe/);
  assert.doesNotMatch(verification, /status\s*=\s*['"]active['"]|setCookie\(|document\.cookie/);
});
