import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationAcceptedResponse } from './invitation-acceptance.mjs';

const success = { status: 200, redirected: false, contentType: 'application/json; charset=utf-8' };
test('only an explicit JSON acknowledgement confirms single-use invitation acceptance', () => {
  assert.equal(invitationAcceptedResponse(success, { ok: true }), true);
  assert.equal(invitationAcceptedResponse({ ...success, contentType: 'application/problem+json' }, { ok: true }), true);
});
test('never treat followed sign-in redirects or HTML success as accepted', () => {
  for (const response of [
    { ...success, redirected: true },
    { ...success, contentType: 'text/html' },
    { ...success, contentType: '' },
    { ...success, status: 204 },
    { ...success, status: 201 },
    null,
  ]) assert.equal(invitationAcceptedResponse(response, { ok: true }), false);
});
test('never accept missing, malformed or false acknowledgement bodies', () => {
  for (const payload of [null, undefined, '', true, [], {}, { ok: false }, { ok: 'true' }, { status: 'success' }]) {
    assert.equal(invitationAcceptedResponse(success, payload), false);
  }
});
