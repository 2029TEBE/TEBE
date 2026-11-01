import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onboardingMutationAcknowledged } from './onboarding-mutation-ack.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const expected = { email: 'invitee@example.test', role: 'team_member' };
const invite = { id, ...expected, expiresAt: '2027-01-01T00:00:00.000Z', deliveryStatus: 'sent' };
const response = (status, payload, type = 'application/json; charset=utf-8') =>
  new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), {
    status, headers: { 'content-type': type },
  });

test('only exact NestJS success contracts confirm each onboarding mutation', async () => {
  assert.equal(await onboardingMutationAcknowledged(response(200, { ok: true }), 'profile'), true);
  assert.equal(await onboardingMutationAcknowledged(response(201, { ok: true }), 'revoke'), true);
  assert.equal(await onboardingMutationAcknowledged(response(201, invite), 'invite', expected), true);
  assert.equal(await onboardingMutationAcknowledged(response(201, invite), 'profile'), false);
  assert.equal(await onboardingMutationAcknowledged(response(200, invite), 'invite', expected), false);
  assert.equal(await onboardingMutationAcknowledged(response(200, { ok: true }), 'revoke'), false);
});

test('HTML, false acknowledgements, malformed JSON and failed statuses never confirm', async () => {
  for (const action of ['profile', 'revoke', 'invite']) {
    const status = action === 'profile' ? 200 : 201;
    for (const res of [response(status, '<html>login</html>', 'text/html'),
      response(status, '{bad-json'), response(status, { ok: false }),
      response(status, null), response(401, { ok: true }), response(403, { ok: true }),
      response(503, { ok: true }), response(status, { ok: true }, 'text/plain')]) {
      assert.equal(await onboardingMutationAcknowledged(res, action, expected), false);
    }
  }
  const redirected = response(201, invite);
  Object.defineProperty(redirected, 'redirected', { value: true });
  assert.equal(await onboardingMutationAcknowledged(redirected, 'invite', expected), false);
});

test('invitation acknowledgement must match recipient, role, delivery and valid ID', async () => {
  for (const change of [{ email: 'other@example.test' }, { role: 'client_admin' },
    { deliveryStatus: 'pending' }, { id: 'not-a-uuid' }, { expiresAt: 'invalid' }]) {
    assert.equal(await onboardingMutationAcknowledged(response(201, { ...invite, ...change }), 'invite', expected), false);
  }
  assert.equal(await onboardingMutationAcknowledged(response(201, { ...invite, email: 'INVITEE@EXAMPLE.TEST' }), 'invite', expected), true);
});

test('oversized success body is rejected without claiming completion', async () => {
  assert.equal(await onboardingMutationAcknowledged(response(201, { ...invite, padding: 'x'.repeat(5000) }), 'invite', expected), false);
});

test('route verifies acknowledgement and settings return marker cannot claim success', () => {
  const route = readFileSync(new URL('../app/api/onboarding/route.ts', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../app/(app)/settings/page.tsx', import.meta.url), 'utf8');
  assert.ok(route.includes('onboardingMutationAcknowledged(result, action, body)'));
  assert.ok(route.includes('onboardingFailurePath(503)'));
  assert.ok(route.includes("target.searchParams.set('done', action)"));
  assert.ok(settings.includes('onboardingReturned'));
  assert.ok(settings.includes('this URL does not confirm'));
  assert.ok(settings.includes('لا يؤكد هذا الرابط'));
  assert.ok(!settings.includes('<Flash error={error} done={done}'));
});
