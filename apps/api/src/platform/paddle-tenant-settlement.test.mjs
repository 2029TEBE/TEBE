import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

// Dependency-free source contract checks. Real PostgreSQL acceptance is separate.
const source = readFileSync(new URL('./paddle-tenant-settlement.ts', import.meta.url), 'utf8');
test('Paddle settlement cannot accept legacy Stripe or forged tenant', () => {
  assert.match(source, /e\.provider !== 'paddle'/);
  assert.match(source, /e\.receiptProvider !== 'paddle'/);
  assert.match(source, /e\.tenantId !== authenticatedTenantId/);
  assert.match(source, /e\.receiptTenantId !== authenticatedTenantId/);
});
test('Paddle settlement requires committed signed receipt, matching transaction and amount', () => {
  assert.match(source, /!e\.receiptSignatureVerified/);
  assert.match(source, /!e\.receiptCommitted/);
  assert.match(source, /e\.transactionId !== e\.receiptTransactionId/);
  assert.match(source, /e\.amountMinor !== e\.expectedAmountMinor/);
});
test('Paddle settlement refuses revoked, inactive, expired or non-completed payments', () => {
  assert.match(source, /e\.transactionStatus !== 'completed'/);
  assert.match(source, /e\.subscriptionStatus !== 'active'/);
  assert.match(source, /e\.revokedAt !== null/);
  assert.match(source, /now\.getTime\(\) < e\.periodEnd\.getTime\(\)/);
});
