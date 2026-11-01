import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCiRlsConfig, assertRestrictedRole, safeCiRlsFailure } from './e62-ci-restricted-rls-negative.mjs';

const good = {
  CI: 'true', GITHUB_ACTIONS: 'true', NODE_ENV: 'test',
  EPMO_CI_RLS_NEGATIVE: 'YES_DISPOSABLE_CI_RLS_NEGATIVE',
  PHASE15_ACCEPT_DISPOSABLE_DB: 'YES_RESEED_DISPOSABLE_TEST_DATABASE',
  DATABASE_URL: 'postgres://pmo_app:ci-password@localhost:5433/pmo',
};
test('allows only explicitly opted-in disposable CI loopback pmo_app', () => {
  assert.equal(validateCiRlsConfig(good).databaseUrl, good.DATABASE_URL);
  for (const change of [
    { CI: 'false' }, { GITHUB_ACTIONS: 'false' }, { NODE_ENV: 'production' },
    { EPMO_CI_RLS_NEGATIVE: '' }, { PHASE15_ACCEPT_DISPOSABLE_DB: '' },
    { DATABASE_URL: 'postgres://postgres:secret@localhost:5433/pmo' },
    { DATABASE_URL: 'postgres://pmo_app:secret@staging.theepmo.com:5433/pmo' },
    { DATABASE_URL: 'postgres://pmo_app:secret@localhost:5432/pmo' },
    { DATABASE_URL: 'postgres://pmo_app:secret@localhost:5433/customer' },
  ]) assert.throws(() => validateCiRlsConfig({ ...good, ...change }), /CONFIG/);
});
test('rejects privileged and bypass roles', () => {
  assert.doesNotThrow(() => assertRestrictedRole([{dbRole:'pmo_app',superuser:false,bypass:false}]));
  for (const r of [
    {dbRole:'postgres',superuser:false,bypass:false},
    {dbRole:'pmo_app',superuser:true,bypass:false},
    {dbRole:'pmo_app',superuser:false,bypass:true},
  ]) assert.throws(() => assertRestrictedRole([r]), /ROLE/);
});
test('never reflects connection credentials or SQL errors in diagnostics', () => {
  const message = safeCiRlsFailure(Object.assign(
    new Error('postgres://pmo_app:password@localhost:5433/pmo'), {code:'28P01'}));
  assert.match(message, /DATABASE/);
  assert.doesNotMatch(message, /password|postgres:\/\//);
});
