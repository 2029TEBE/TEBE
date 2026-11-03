import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationDisplay } from './invitation-display.ts';
const now = Date.parse('2026-11-03T00:00:00Z');
const invite = {deliveryStatus:'sent', expiresAt:'2026-11-04T00:00:00Z'};
test('accepted, revoked, failed, expired and awaiting invitations have distinct actions', () => {
  for (const [changes, state, resend] of [
    [{}, 'awaiting', true], [{consumedAt:'2026-11-02'}, 'activated', false],
    [{revokedAt:'2026-11-02'}, 'revoked', false],
    [{deliveryStatus:'failed',revokedAt:'2026-11-02'}, 'failed', false],
    [{expiresAt:'2026-11-02'}, 'expired', true], [{expiresAt:'bad-date'}, 'unknown', false],
    [{deliveryStatus:'delivered'}, 'unknown', false],
  ]) {
    const d = invitationDisplay({...invite,...changes},'en',now);
    assert.equal(d.state,state); assert.equal(d.mayResend,resend);
  }
});
test('provider acceptance is not presented as delivery and labels support Arabic', () => {
  assert.match(invitationDisplay(invite,'en',now).label, /Provider accepted/);
  assert.match(invitationDisplay(invite,'ar',now).label, /بانتظار التفعيل/);
});
