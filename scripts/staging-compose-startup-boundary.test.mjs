import test from 'node:test';
import assert from 'node:assert/strict';
import { safeStagingStartupBoundary } from '../infra/staging/compose-startup-boundary.mjs';
import { inspectResolvedStagingCompose } from '../infra/staging/verify-resolved-compose.mjs';

const names = ['postgres', 'redis', 'api', 'web', 'staging-edge'];
const fixture = () => ({
  postgres: { image: 'postgres:16-alpine' },
  redis: { image: 'redis:7-alpine', command: ['redis-server', '--requirepass', 'synthetic-only'] },
  api: { image: 'epmo-staging-api:sha-' + 'a'.repeat(40) },
  web: { image: 'epmo-staging-web:sha-' + 'a'.repeat(40) },
  'staging-edge': { image: 'nginx:1.28-alpine' },
});
const integrated = services => inspectResolvedStagingCompose({ services }, 'a'.repeat(40))
  .find(check => check.name === 'No unreviewed staging image or startup override')?.passed;

test('S46 accepts reviewed staging image and Redis argv contract', () => {
  assert.equal(safeStagingStartupBoundary(fixture()), true);
  assert.equal(integrated(fixture()), true);
});

test('S46 rejects arbitrary command or entrypoint on every service', () => {
  for (const name of names) {
    for (const [field, value] of [['entrypoint', ['/bin/sh', '-c', 'exit 0']],
      ['command', ['sh', '-c', 'exit 0']]]) {
      const model = fixture(); model[name][field] = value;
      assert.equal(safeStagingStartupBoundary(model), false, `${name}:${field}`);
      assert.equal(integrated(model), false, `${name}:${field}:integration`);
    }
  }
});

test('S46 rejects Redis auth bypass and extra arguments', () => {
  for (const command of [[], 'redis-server --protected-mode no',
    ['redis-server'], ['redis-server', '--protected-mode', 'no'],
    ['redis-server', '--requirepass', ''],
    ['redis-server', '--requirepass', 'synthetic-only', '--protected-mode', 'no']]) {
    const model = fixture(); model.redis.command = command;
    assert.equal(safeStagingStartupBoundary(model), false);
  }
});

test('S46 rejects unexpected base images and build directives', () => {
  for (const name of ['postgres', 'redis', 'staging-edge']) {
    const model = fixture(); model[name].image = 'example.invalid/prod:latest';
    assert.equal(safeStagingStartupBoundary(model), false, name);
    const other = fixture(); other[name].build = { context: '/tmp/unsafe' };
    assert.equal(safeStagingStartupBoundary(other), false, name + ':build');
  }
});

test('S46 rejects startup/runtime override fields even when empty', () => {
  for (const name of names) for (const field of [
    'init', 'user', 'working_dir', 'stdin_open', 'tty', 'profiles', 'isolation']) {
    const model = fixture(); model[name][field] = field === 'profiles' ? [] : false;
    assert.equal(safeStagingStartupBoundary(model), false, `${name}:${field}`);
  }
});

test('S46 rejects malformed or missing services', () => {
  for (const model of [null, [], {}, { postgres: {} }])
    assert.equal(safeStagingStartupBoundary(model), false);
});
