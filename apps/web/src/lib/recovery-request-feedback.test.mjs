import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryRequestErrorText } from './recovery-request-feedback.mjs';
import { createRecoverySubmissionGate } from './recovery-reset-feedback.mjs';

test('recovery request guidance is bilingual, status-specific and never enumerates accounts', () => {
  for (const status of [0, 400, 401, 403, 404, 409, 429, 500, 502, 503, 504, undefined]) {
    for (const lang of ['en', 'ar']) {
      const message = recoveryRequestErrorText(status, lang);
      assert.ok(message.length > 20);
      assert.doesNotMatch(message, /example\.test|account (does not exist|not found)|stack trace|postgres|SELECT/i);
    }
  }
  assert.match(recoveryRequestErrorText(429, 'en'), /Too many recovery requests/);
  assert.match(recoveryRequestErrorText(503, 'en'), /service is unavailable/);
  assert.match(recoveryRequestErrorText(429, 'ar'), /محاولات كثيرة/);
  assert.notEqual(recoveryRequestErrorText(429, 'en'), recoveryRequestErrorText(503, 'en'));
});

test('request submission is synchronous single-flight, retryable after failure, locked after success', () => {
  const gate = createRecoverySubmissionGate();
  assert.equal(gate.begin(), true);
  assert.equal(gate.begin(), false, 'rapid duplicate submit must not send a second email');
  gate.settle(false);
  assert.equal(gate.begin(), true, 'failed attempt may be explicitly retried');
  gate.settle(true);
  assert.equal(gate.begin(), false, 'successful request must not replay');
  gate.settle(false);
  assert.equal(gate.begin(), false);
});
