import test from 'node:test';
import assert from 'node:assert/strict';
import { safeStagingEnvironmentBoundary } from '../infra/staging/compose-environment-boundary.mjs';
import { inspectResolvedStagingCompose } from '../infra/staging/verify-resolved-compose.mjs';

const sha = 'a'.repeat(40);
const fixture = () => ({
  name: 'pmo-staging',
  networks: { 'staging-data': { internal: true, name: 'pmo-staging_staging-data' },
    'staging-app': { name: 'pmo-staging_staging-app' } },
  volumes: { pgdata: { name: 'pmo-staging_pgdata' } },
  services: {
    postgres: { image: 'postgres:16-alpine', networks: { 'staging-data': null },
      environment: { POSTGRES_USER: 'synthetic', POSTGRES_PASSWORD: 'synthetic', POSTGRES_DB: 'pmo' },
      volumes: [{ type: 'volume', source: 'pgdata', target: '/var/lib/postgresql/data' }] },
    redis: { image: 'redis:7-alpine', command: ['redis-server', '--requirepass', 'synthetic'],
      networks: { 'staging-data': null } },
    api: { networks: { 'staging-data': null, 'staging-app': null },
      image: 'epmo-staging-api:sha-' + sha, environment: {
        NODE_ENV: 'production', DEPLOYMENT_ENV: 'staging', ALLOW_HEADER_AUTH: 'false',
        API_PORT: '4000', WEB_INTERNAL_URL: 'http://web:3000',
        DATABASE_URL: 'postgres://app:fixture@postgres:5432/pmo',
        REDIS_URL: 'redis://:fixture@redis:6379',
        WEB_ORIGIN: 'https://staging.theepmo.com',
        BILLING_REFERENCE_WEBHOOK_ENABLED: 'false', STRIPE_SECRET_KEY: 'sk_test_fixture' } },
    web: { networks: { 'staging-app': null }, image: 'epmo-staging-web:sha-' + sha,
      ports: [{ host_ip: '127.0.0.1', target: 3000, published: '3001' }],
      environment: { NODE_ENV: 'production', API_URL: 'http://api:4000',
        WEB_ORIGIN: 'https://staging.theepmo.com',
        NEXT_PUBLIC_API_URL: 'https://api-staging.theepmo.com' } },
    'staging-edge': { image: 'nginx:1.28-alpine', networks: { 'staging-app': null },
      ports: [{ host_ip: '127.0.0.1', target: 8443, published: '8443' }] },
  },
});
const denied = model => inspectResolvedStagingCompose(model, sha)
  .some(c => c.name === 'No unreviewed container environment or internal endpoint override' && !c.passed);

test('S50 accepts reviewed synthetic staging environment and private service URLs', () => {
  const model = fixture();
  assert.equal(safeStagingEnvironmentBoundary(model.services), true);
  assert.equal(denied(model), false);
});

test('S50 blocks web credential exfiltration and injected public build variables', () => {
  for (const name of ['STRIPE_SECRET_KEY', 'MS_CLIENT_SECRET', 'AWS_SECRET_ACCESS_KEY',
    'DATABASE_URL', 'NEXT_PUBLIC_STRIPE_SECRET_KEY', 'NODE_OPTIONS']) {
    const model = fixture();
    model.services.web.environment[name] = 'sensitive-value-must-never-be-printed';
    assert.equal(denied(model), true, name);
  }
});

test('S50 blocks proxy, runtime and provider credential injection into API', () => {
  for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NODE_OPTIONS',
    'LD_PRELOAD', 'AWS_ACCESS_KEY_ID', 'PGHOSTADDR']) {
    const model = fixture();
    model.services.api.environment[name] = 'https://production.example';
    assert.equal(denied(model), true, name);
  }
});

test('S50 blocks PostgreSQL, Redis and TLS-edge environment overrides', () => {
  for (const [name, key] of [
    ['postgres', 'POSTGRES_INITDB_ARGS'], ['redis', 'REDIS_PASSWORD'],
    ['staging-edge', 'NGINX_ENTRYPOINT_QUIET_LOGS'],
  ]) {
    const model = fixture();
    model.services[name].environment ??= {};
    model.services[name].environment[key] = 'unexpected';
    assert.equal(denied(model), true, name);
  }
});

test('S50 rejects non-string, array and null inherited environment values', () => {
  for (const value of [null, ['NODE_ENV=production'], { NODE_ENV: null },
    { NODE_ENV: 1 }]) {
    const model = fixture();
    model.services.web.environment = value;
    assert.equal(denied(model), true);
  }
});

test('S50 refuses private API/web endpoint redirection without leaking values', () => {
  for (const [service, key, value] of [
    ['web', 'API_URL', 'http://production-api:4000'],
    ['api', 'WEB_INTERNAL_URL', 'http://production-web:3000'],
    ['api', 'API_PORT', '4444'],
  ]) {
    const model = fixture();
    model.services[service].environment[key] = value;
    assert.equal(denied(model), true, key);
  }
});
