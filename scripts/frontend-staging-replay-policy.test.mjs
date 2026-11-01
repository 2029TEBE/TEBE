import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  STAGING_WEB, STAGING_API, REPLAY_VARIANTS, stagingReplayConfiguration,
  assertStagingBrowserRequest, sanitizedStagingCheck,
} from './frontend-staging-replay-policy.mjs';

const fixture = {
  EPMO_STAGING_REPLAY_CONFIRM: 'YES_AUTHORIZED_SYNTHETIC_HTTPS_STAGING',
  EPMO_STAGING_WEB_ORIGIN: STAGING_WEB,
  EPMO_STAGING_API_ORIGIN: STAGING_API,
  EPMO_STAGING_EXACT_SHA: 'a'.repeat(40),
  EPMO_STAGING_ADMIN_USER: 'admin@disposable.test',
  EPMO_STAGING_RESTRICTED_USER: 'member@disposable.test',
  EPMO_STAGING_ADMIN_PASSWORD: 'synthetic-admin',
  EPMO_STAGING_RESTRICTED_PASSWORD: 'synthetic-member',
};

test('F63 refuses unapproved staging, non-TLS, production origins and unpinned SHA', () => {
  assert.equal(stagingReplayConfiguration(fixture).sha, 'a'.repeat(40));
  for (const override of [
    { EPMO_STAGING_REPLAY_CONFIRM: '' },
    { EPMO_STAGING_WEB_ORIGIN: 'https://theepmo.com' },
    { EPMO_STAGING_WEB_ORIGIN: 'http://staging.theepmo.com' },
    { EPMO_STAGING_API_ORIGIN: 'https://staging.theepmo.com' },
    { EPMO_STAGING_EXACT_SHA: 'a'.repeat(7) },
    { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    { EPMO_STAGING_ADMIN_USER: 'person@gmail.com' },
    { EPMO_STAGING_RESTRICTED_USER: fixture.EPMO_STAGING_ADMIN_USER },
    { EPMO_STAGING_ADMIN_PASSWORD: '' },
    { EPMO_STAGING_UAT_OUT: '/etc/epmo' },
  ]) assert.throws(() => stagingReplayConfiguration({ ...fixture, ...override }));
});

test('F63 only permits two exact staging origins and data/blob, never arbitrary provider redirects', () => {
  for (const url of [`${STAGING_WEB}/login`, `${STAGING_API}/health`, 'data:text/plain,a', 'blob:https://staging.theepmo.com/abc'])
    assert.equal(assertStagingBrowserRequest(url), true);
  for (const url of ['https://theepmo.com', 'https://evil-staging.theepmo.com', 'http://staging.theepmo.com', 'https://login.microsoftonline.com', 'blob:https://evil.example/abc', 'file:///etc/passwd'])
    assert.equal(assertStagingBrowserRequest(url), false);
});

test('F63 evidence contains only fixed scenario labels and no raw diagnostics', () => {
  assert.deepEqual(REPLAY_VARIANTS.map(v => [v.width, v.lang, v.dir]), [[375, 'ar', 'rtl'], [1440, 'en', 'ltr']]);
  assert.deepEqual(sanitizedStagingCheck('restricted_billing_denial', false), { name: 'restricted_billing_denial', status: 'FAIL', code: 'assertion_failed' });
  assert.throws(() => sanitizedStagingCheck('admin@private.test', false));
});

test('F63 live replay never mocks provider responses, saves session state or captures authenticated screenshots', async () => {
  const source = await readFile(new URL('./frontend-staging-replay.mjs', import.meta.url), 'utf8');
  for (const banned of ['route.fulfill(', 'ignoreHTTPSErrors: true', 'context.tracing.start(', 'storageState(', 'response.body(', 'response.text(', 'response.json('])
    assert.ok(!source.includes(banned), `Forbidden staging evidence behavior: ${banned}`);
  for (const required of ['stagingReplayConfiguration(process.env)', 'assertStagingBrowserRequest', 'admin_subscription_visibility', 'workspace_round_trip', 'restricted_onboarding_403', 'logout_revokes_session', 'BLOCKED_EXTERNAL_INPUT'])
    assert.ok(source.includes(required), `Missing real staging check: ${required}`);
});
