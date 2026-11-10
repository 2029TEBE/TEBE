import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPaddleSubscriptionEvent, decidePaddleSubscriptionUpdate, paddleAccessAllowed } from './paddle-subscription-policy.ts';

const sub = 'sub_' + 'a'.repeat(26);
const customer = 'ctm_' + 'b'.repeat(26);
const product = 'pro_' + 'c'.repeat(26);
const price = 'pri_' + 'd'.repeat(26);
const tenant = '2bb4c19e-ac7d-47a3-8fa1-f917640e127a';
const event = (overrides = {}) => ({
  eventId: 'evt_' + 'e'.repeat(26),
  eventType: 'subscription.updated',
  occurredAt: '2026-11-10T16:00:00.000Z',
  data: { id: sub, customer_id: customer, status: 'active',
    items: [{ price: { id: price, product_id: product } }] },
  ...overrides,
});
const binding = { tenantId: tenant, providerSubscriptionId: sub,
  providerCustomerId: customer, lastEventId: null, lastEventAt: null };

test('valid subscription update parses without trusting custom tenant data', () => {
  const p = readPaddleSubscriptionEvent(event());
  assert.equal(p.providerSubscriptionId, sub);
  assert.deepEqual(p.priceIds, [price]);
  assert.deepEqual(p.productIds, [product]);
  assert.equal(decidePaddleSubscriptionUpdate(p, binding), 'apply');
});
test('ignore unrelated events', () => {
  assert.equal(readPaddleSubscriptionEvent(event({eventType:'transaction.completed'})), null);
});
test('mismatched customer or subscription blocks application', () => {
  const p = readPaddleSubscriptionEvent(event());
  assert.throws(() => decidePaddleSubscriptionUpdate(p, {...binding, providerCustomerId:'ctm_'+'x'.repeat(26)}));
  assert.throws(() => decidePaddleSubscriptionUpdate(p, {...binding, providerSubscriptionId:'sub_'+'x'.repeat(26)}));
});
test('duplicates and late notifications cannot overwrite current state', () => {
  const p = readPaddleSubscriptionEvent(event());
  assert.equal(decidePaddleSubscriptionUpdate(p, {...binding, lastEventId:p.eventId, lastEventAt:p.occurredAt}), 'duplicate');
  assert.equal(decidePaddleSubscriptionUpdate(p, {...binding, lastEventAt:'2026-11-10T16:00:01.000Z'}), 'stale');
  assert.throws(() => decidePaddleSubscriptionUpdate(p, {...binding, lastEventAt:p.occurredAt}));
});
test('reject malformed IDs and unknown status', () => {
  assert.throws(() => readPaddleSubscriptionEvent(event({data:{...event().data, id:'other'}})));
  assert.throws(() => readPaddleSubscriptionEvent(event({data:{...event().data, status:'unknown'}})));
  assert.throws(() => readPaddleSubscriptionEvent(event({data:{...event().data, items:[]}})));
});
test('provider status access rules are conservative', () => {
  assert.equal(paddleAccessAllowed('active'), true);
  assert.equal(paddleAccessAllowed('trialing'), true);
  assert.equal(paddleAccessAllowed('past_due'), false);
  assert.equal(paddleAccessAllowed('paused'), false);
  assert.equal(paddleAccessAllowed('canceled'), false);
});
