import test from 'node:test';
import assert from 'node:assert/strict';
import { safeStagingSecretBoundary } from '../infra/staging/compose-secret-boundary.mjs';
import { inspectResolvedStagingCompose } from '../infra/staging/verify-resolved-compose.mjs';

const names = ['postgres', 'redis', 'api', 'web', 'staging-edge'];
const fixture = () => ({ services: Object.fromEntries(names.map(name => [name, {}])) });

test('S45 accepts reviewed staging services with no Compose secret/config sources', () => {
  assert.equal(safeStagingSecretBoundary(fixture()), true);
  assert.equal(safeStagingSecretBoundary({ ...fixture(), secrets: {}, configs: {} }), true);
});

test('S45 rejects top-level file-backed and external secret/config declarations', () => {
  for (const field of ['secrets', 'configs']) {
    for (const value of [{ production: { file: '/etc/epmo/prod.key' } },
      { provider: { external: true } }, [], null]) {
      assert.equal(safeStagingSecretBoundary({ ...fixture(), [field]: value }), false, field);
    }
  }
});

test('S45 rejects service-level secrets and configs even without top-level declarations', () => {
  for (const name of names) {
    for (const field of ['secrets', 'configs']) {
      const config = fixture();
      config.services[name][field] = [{ source: 'production', target: '/run/secrets/db' }];
      assert.equal(safeStagingSecretBoundary(config), false, `${name}:${field}`);
      config.services[name][field] = [];
      assert.equal(safeStagingSecretBoundary(config), false, `${name}:${field}:empty`);
    }
  }
});

test('S45 rejects credential injection and unreviewed Compose lifecycle execution', () => {
  const forbidden = {
    credential_spec: { file: '/tmp/production-identity.json' },
    develop: { watch: [{ action: 'sync', path: '/etc', target: '/run/keys' }] },
    extends: { file: '/tmp/production-compose.yml', service: 'api' },
    post_start: [{ command: 'sh -c "cat /run/secrets/key"' }],
    pre_stop: [{ command: 'sh -c "curl example.invalid"' }],
  };
  for (const name of names) for (const [field, value] of Object.entries(forbidden)) {
    const config = fixture(); config.services[name][field] = value;
    assert.equal(safeStagingSecretBoundary(config), false, `${name}:${field}`);
  }
});

test('S45 fails closed on missing or malformed Compose service models', () => {
  for (const value of [null, [], {}, { services: [] }, { services: null }])
    assert.equal(safeStagingSecretBoundary(value), false);
  const missing = fixture(); delete missing.services.postgres;
  assert.equal(safeStagingSecretBoundary(missing), false);
});

test('S45 resolved Compose verifier invokes the secret boundary before readiness', () => {
  const check = config => inspectResolvedStagingCompose(config, 'a'.repeat(40))
    .find(item => item.name === 'No unreviewed Compose secrets, configs or credential injection')?.passed;
  assert.equal(check(fixture()), true);
  const bad = fixture(); bad.services.api.secrets = [{ source: 'production' }];
  assert.equal(check(bad), false);
  assert.equal(check({ ...fixture(), configs: { prod: { file: '/etc/prod.conf' } } }), false);
});
