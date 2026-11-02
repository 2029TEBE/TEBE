import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStagingRlsConfig, safeStagingRlsFailure } from './e66-staging-rls-acceptance.mjs';

const sha = 'd5ef5065f2c1794f7956b837c968bfd4c8374762';
const good = () => ({
  DEPLOYMENT_ENV: 'staging',
  EPMO_STAGING_RLS_CONFIRM: 'YES_AUTHORIZED_SYNTHETIC_STAGING_RLS',
  EPMO_STAGING_RLS_SYNTHETIC_FIXTURES: 'YES_ISOLATED_SYNTHETIC_TENANTS',
  EPMO_STAGING_RLS_SOURCE_SHA: sha,
  EPMO_STAGING_RLS_DEPLOYED_SHA: sha,
  EPMO_STAGING_RLS_DB_URL: 'postgres://pmo_app:synthetic-secret@127.0.0.1:15433/pmo',
  EPMO_STAGING_RLS_TENANT_A_ID: '11111111-1111-4111-8111-111111111111',
  EPMO_STAGING_RLS_TENANT_B_ID: '22222222-2222-4222-8222-222222222222',
  EPMO_STAGING_RLS_PROJECT_A_ID: '33333333-3333-4333-8333-333333333333',
  EPMO_STAGING_RLS_PROJECT_B_ID: '44444444-4444-4444-8444-444444444444',
});

test('staging accepts only explicit synthetic fixture and loopback-tunnel configuration', () => {
  const result = validateStagingRlsConfig(good(), sha);
  assert.equal(result.sourceSha, sha);
  assert.equal(result.ids.tenantA, good().EPMO_STAGING_RLS_TENANT_A_ID);
});
test('fails closed on missing authorization, production, or wrong immutable SHA', () => {
  for (const patch of [
    { EPMO_STAGING_RLS_CONFIRM: '' },
    { EPMO_STAGING_RLS_SYNTHETIC_FIXTURES: '' },
    { DEPLOYMENT_ENV: 'production' },
    { NODE_ENV: 'production' },
    { EPMO_STAGING_RLS_SOURCE_SHA: 'a'.repeat(40) },
    { EPMO_STAGING_RLS_DEPLOYED_SHA: 'b'.repeat(40) },
  ]) assert.throws(() => validateStagingRlsConfig({ ...good(), ...patch }, sha), /CONFIG/);
});
test('refuses public DB endpoints, privileged role, default ports and wrong database', () => {
  for (const dbUrl of [
    'postgres://pmo_app:secret@staging.theepmo.com:15433/pmo',
    'postgres://postgres:secret@127.0.0.1:15433/pmo',
    'postgres://pmo_app:secret@127.0.0.1:5432/pmo',
    'postgres://pmo_app:secret@127.0.0.1:15433/production',
    'postgres://pmo_app:secret@127.0.0.1:15433/pmo?sslmode=disable',
  ]) assert.throws(() => validateStagingRlsConfig({ ...good(), EPMO_STAGING_RLS_DB_URL: dbUrl }, sha), /CONFIG/);
});
test('refuses reused, malformed, or missing tenant/project IDs', () => {
  for (const patch of [
    { EPMO_STAGING_RLS_TENANT_B_ID: good().EPMO_STAGING_RLS_TENANT_A_ID },
    { EPMO_STAGING_RLS_PROJECT_B_ID: 'not-a-uuid' },
    { EPMO_STAGING_RLS_PROJECT_A_ID: '' },
  ]) assert.throws(() => validateStagingRlsConfig({ ...good(), ...patch }, sha), /CONFIG/);
});
test('never echoes raw database errors, URLs or secrets', () => {
  assert.equal(safeStagingRlsFailure(new Error('postgres://pmo_app:secret@127.0.0.1:15433/pmo')), 'BLOCKED E66 staging RLS: DATABASE');
  assert.equal(safeStagingRlsFailure({ code: 'FOREIGN_WRITE' }), 'BLOCKED E66 staging RLS: FOREIGN_WRITE');
});
