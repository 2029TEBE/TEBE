import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyPaddleSignature, parseVerifiedPaddleEvent } from './paddle-signature.ts';

const secret = 'pdl_ntfset_test_verification_secret_12345';
const nowMs = 1762790400000;
const ts = String(nowMs / 1000);
const raw = Buffer.from(JSON.stringify({
  event_id: 'evt_123456789',
  event_type: 'subscription.updated',
  occurred_at: '2026-11-10T16:00:00.000Z',
  data: { id: 'sub_123', status: 'active' },
}));
const digest = createHmac('sha256', secret).update(ts).update(':').update(raw).digest('hex');
const signature = `ts=${ts};h1=${digest}`;

test('valid raw-body signature verifies', () => {
  assert.equal(verifyPaddleSignature(raw, signature, secret, nowMs), true);
});
test('valid rotated signatures verify when one h1 is correct', () => {
  assert.equal(verifyPaddleSignature(raw, `ts=${ts};h1=${'0'.repeat(64)};h1=${digest}`, secret, nowMs), true);
});
test('different raw bytes fail verification', () => {
  assert.equal(verifyPaddleSignature(Buffer.concat([raw, Buffer.from(' ')]), signature, secret, nowMs), false);
});
test('incorrect destination secret fails', () => {
  assert.equal(verifyPaddleSignature(raw, signature, secret + 'wrong', nowMs), false);
});
test('missing, malformed and duplicated timestamp fail closed', () => {
  for (const header of [undefined, '', 'h1=' + digest, `ts=${ts};ts=${ts};h1=${digest}`, `ts=oops;h1=${digest}`, `ts=${ts},h1=${digest}`]) {
    assert.equal(verifyPaddleSignature(raw, header, secret, nowMs), false);
  }
});
test('older than five seconds or future timestamp is rejected', () => {
  assert.equal(verifyPaddleSignature(raw, signature, secret, nowMs + 5001), false);
  assert.equal(verifyPaddleSignature(raw, signature, secret, nowMs - 5001), false);
});
test('rejects invalid bodies or oversized inputs', () => {
  assert.equal(verifyPaddleSignature(Buffer.alloc(0), signature, secret, nowMs), false);
  assert.equal(verifyPaddleSignature(Buffer.alloc(262145), signature, secret, nowMs), false);
  assert.equal(verifyPaddleSignature(raw, signature, secret, NaN), false);
});
test('parse signed event metadata without provisioning', () => {
  assert.deepEqual(parseVerifiedPaddleEvent(raw), {
    eventId: 'evt_123456789',
    eventType: 'subscription.updated',
    occurredAt: '2026-11-10T16:00:00.000Z',
    data: { id: 'sub_123', status: 'active' },
  });
});
test('event metadata rejects invalid structure', () => {
  assert.throws(() => parseVerifiedPaddleEvent(Buffer.from('invalid json')));
  assert.throws(() => parseVerifiedPaddleEvent(Buffer.from(JSON.stringify({ event_id: 'evt_123', event_type: 'subscription.updated', occurred_at: 'x', data: {} }))));
  assert.throws(() => parseVerifiedPaddleEvent(Buffer.from(JSON.stringify({ event_id: 'evt_123', event_type: 'subscription.updated', occurred_at: '2026-11-10T16:00:00.000Z', data: [] }))));
});
