import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recoveryResetErrorText, createRecoverySubmissionGate } from './recovery-reset-feedback.mjs';

test('reset failure guidance distinguishes invalid token, rate limiting, and transient outage in both locales', () => {
  for (const lang of ['en', 'ar']) {
    const invalid = recoveryResetErrorText(400, lang);
    const rate = recoveryResetErrorText(429, lang);
    const outage = recoveryResetErrorText(503, lang);
    assert.ok(invalid.length > 30 && rate.length > 30 && outage.length > 30);
    assert.notEqual(invalid, rate);
    assert.notEqual(invalid, outage);
    assert.notEqual(rate, outage);
    for (const message of [invalid, rate, outage]) {
      assert.doesNotMatch(message, /Bearer |stack trace|SQL|secret=/i);
    }
    assert.equal(recoveryResetErrorText(0, lang), outage);
    assert.equal(recoveryResetErrorText(504, lang), outage);
    assert.equal(recoveryResetErrorText(410, lang), invalid);
  }
});

test('reset gate blocks duplicate in-flight POST and replay after confirmed success', () => {
  const gate = createRecoverySubmissionGate();
  assert.equal(gate.begin(), true);
  assert.equal(gate.begin(), false, 'a second submit cannot replay the token');
  gate.settle(true);
  assert.equal(gate.begin(), false, 'success permanently locks this mounted form');
  gate.settle(false);
  assert.equal(gate.begin(), false);
});

test('reset gate permits an explicit retry only after failure', () => {
  const gate = createRecoverySubmissionGate();
  assert.equal(gate.begin(), true);
  gate.settle(false);
  assert.equal(gate.begin(), true);
  assert.equal(gate.begin(), false);
  gate.settle(true);
  assert.equal(gate.begin(), false);
});

test('password reset form wires status-only errors and the single-flight gate', async () => {
  const source = await readFile(new URL('../app/reset-password/ResetPasswordForm.tsx', import.meta.url), 'utf8');
  assert.match(source, /useRef\(createRecoverySubmissionGate\(\)\)/);
  assert.match(source, /if \(!submissionGate\.current\.begin\(\)\) return;/);
  assert.match(source, /submissionGate\.current\.settle\(succeeded\)/);
  assert.match(source, /recoveryResetErrorText\(res\.status, lang\)/);
  assert.match(source, /recoveryResetErrorText\(0, lang\)/);
  assert.match(source, /disabled=\{busy\}/);
  assert.doesNotMatch(source, /\(e as Error\)\.message/);
});
