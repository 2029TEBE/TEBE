import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePaddleSandboxSettlement as evaluate } from './paddle-sandbox-settlement-policy.mjs';

const tenantId = '11111111-1111-4111-8111-111111111111';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const intent = () => ({
  provider: 'paddle', environment: 'sandbox', tenantId, subscriptionId,
  transactionId: 'txn_abc123', priceId: 'pri_abc123', amountMinor: 11500,
  currency: 'SAR', expiresAt: 200000,
});
const event = () => ({
  event_id: 'evt_abcdefghijklmnopqrstuvwxyz', event_type: 'transaction.completed',
  data: { id: 'txn_abc123', status: 'completed', subscription_id: 'sub_abc123',
    currency_code: 'SAR', details: {
      line_items: [{ price: { id: 'pri_abc123' }, quantity: 1 }],
      totals: { grand_total: '11500' },
    },
  },
});
const check = (e=event(), i=intent(), options={}) =>
  evaluate(e, i, { signatureVerified: true, now: 100000, ...options });

test('completed signed sandbox event produces persistence-required candidate, not entitlement', () => {
  const result = check();
  assert.equal(result.accepted, true);
  assert.equal(result.requiresAtomicPersistence, true);
  assert.equal(result.tenantId, tenantId);
  assert.equal(Object.hasOwn(result, 'entitlementGranted'), false);
});
test('reject unsigned, live-mode, expired and untrusted intent', () => {
  assert.equal(check(event(), intent(), { signatureVerified: false }).accepted, false);
  const live = intent(); live.environment = 'production';
  assert.equal(check(event(), live).accepted, false);
  assert.equal(check(event(), intent(), { now: 200001 }).accepted, false);
  assert.equal(check(event(), null).accepted, false);
});
test('reject wrong transaction, subscription and tenant', () => {
  const wrong = event(); wrong.data.id = 'txn_other';
  assert.equal(check(wrong).accepted, false);
  const wrongSub = intent(); wrongSub.subscriptionProviderId = 'sub_other';
  assert.equal(check(event(), wrongSub).accepted, false);
  const wrongTenant = event(); wrongTenant.data.custom_data = { tenantId: 'another' };
  assert.equal(check(wrongTenant).accepted, false);
});
test('reject wrong currency, amount, price and quantity', () => {
  const currency = event(); currency.data.currency_code = 'USD';
  assert.equal(check(currency).accepted, false);
  const amount = event(); amount.data.details.totals.grand_total = '11499';
  assert.equal(check(amount).accepted, false);
  const price = event(); price.data.details.line_items[0].price.id = 'pri_other';
  assert.equal(check(price).accepted, false);
  const quantity = event(); quantity.data.details.line_items[0].quantity = 2;
  assert.equal(check(quantity).accepted, false);
});
test('reject pending payments and lifecycle events as paid settlement', () => {
  const pending = event(); pending.data.status = 'billed';
  assert.equal(check(pending).accepted, false);
  const canceled = event(); canceled.event_type = 'subscription.canceled';
  assert.equal(check(canceled).accepted, false);
});
