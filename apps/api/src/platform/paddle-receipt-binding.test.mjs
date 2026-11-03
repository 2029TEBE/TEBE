import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./paddle-tenant-settlement.ts', import.meta.url), 'utf8');

test('receipt must match the server-owned subscription and its tenant', () => {
  assert.match(source, /e\.tenantId !== authenticatedTenantId/);
  assert.match(source, /e\.receiptTenantId !== authenticatedTenantId/);
  assert.match(source, /e\.subscriptionId !== e\.expectedSubscriptionId/);
  assert.match(source, /e\.receiptSubscriptionId !== e\.subscriptionId/);
});
test('unidentified webhook event or receipt cannot authorize a Paddle settlement', () => {
  assert.match(source, /!validId\(e\.receiptEventId\)/);
  assert.match(source, /!validId\(e\.receiptId\)/);
  assert.match(source, /!e\.receiptSignatureVerified/);
  assert.match(source, /!e\.receiptCommitted/);
});
test('historical Stripe evidence cannot authorize Paddle entitlement', () => {
  assert.match(source, /e\.provider !== 'paddle'/);
  assert.match(source, /e\.receiptProvider !== 'paddle'/);
});
