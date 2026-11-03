import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const billing = readFileSync(new URL('../app/(app)/billing/page.tsx', import.meta.url), 'utf8');
const pending = readFileSync(new URL('../app/(app)/billing/payment-pending/page.tsx', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../../../api/src/platform/paid-deployment.controller.ts', import.meta.url), 'utf8');

test('Q86 provides navigation only after a pending Stripe return, not a fake entitlement', () => {
  assert.match(billing, /checkoutReturn === 'awaiting-webhook'/);
  assert.match(billing, /<Link href="\/billing\/payment-pending">/);
  assert.match(pending, /getLayoutSession\(\)/);
  assert.match(pending, /pmoa_admin/);
  assert.match(pending, /api\.subscriptionCurrent\(\)/);
  assert.match(pending, /effectiveSubscriptionStatus/);
  assert.match(pending, /dir=\{ar \? 'rtl' : 'ltr'\}/);
  assert.doesNotMatch(pending, /setCookie\(|localStorage|sessionStorage|searchParams/);
  assert.match(pending, /Stripe redirect is not payment proof/);
});

test('Q86 controller receipt query is complete; no duplicated or truncated method tail', () => {
  const match = controller.match(/sql\x60[\s\S]*?\x60\)\)/g) ?? [];
  assert.equal(match.length, 1, 'exactly one complete SQL template in paid access method');
  assert.match(controller, /r\.payload_sha256 ~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(controller, /e\.tenant_id = s\.tenant_id/);
  assert.match(controller, /i\.period_ends_at = s\.period_ends_at/);
  assert.equal((controller.match(/return\s*\{\s*deploymentId:/g) ?? []).length, 1);
  assert.equal((controller.match(/throw new ForbiddenException\('Access unavailable'\)/g) ?? []).length, 2);
});
