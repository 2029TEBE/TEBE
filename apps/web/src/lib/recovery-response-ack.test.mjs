import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recoveryAcknowledged } from './recovery-response-ack.mjs';
const response = (status = 200, contentType = 'application/json; charset=utf-8', redirected = false) => ({
  status, redirected, headers: { get: name => name.toLowerCase() === 'content-type' ? contentType : null },
});
test('only explicit same-origin recovery JSON acknowledgement confirms success', () => {
  assert.equal(recoveryAcknowledged(response(), { ok: true }), true);
  assert.equal(recoveryAcknowledged(response(200, 'application/json'), { ok: true }), true);
  for (const value of [{ ok: false }, {}, [], null, 'ok', true, { success: true }])
    assert.equal(recoveryAcknowledged(response(), value), false);
});
test('HTML, redirected, missing content type and non-200 responses fail closed', () => {
  for (const r of [response(200, 'text/html'), response(200, null), response(200, 'application/json', true),
    response(201), response(204), response(401), response(403), response(429), response(503), null])
    assert.equal(recoveryAcknowledged(r, { ok: true }), false);
});
test('both browser recovery forms require verified JSON before success UI', () => {
  for (const path of ['../app/reset-password/ResetPasswordForm.tsx', '../app/forgot-password/RecoveryRequestForm.tsx']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /recoveryAcknowledged\(res, payload\)/);
    assert.match(source, /await res\.json\(\)/);
    assert.match(source, /recovery[A-Za-z]+ErrorText\('unconfirmed', lang\)/);
    assert.match(source, /if \(!res\.ok\)/);
  }
});
