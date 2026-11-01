import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeStagingBuildBoundary as safe } from '../infra/staging/compose-build-boundary.mjs';
import { inspectResolvedStagingCompose } from '../infra/staging/verify-resolved-compose.mjs';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const names = ['postgres', 'redis', 'api', 'web', 'staging-edge'];
const fixture = () => Object.fromEntries(names.map(name => [name, {}]));
const checked = services => inspectResolvedStagingCompose({ services }, 'a'.repeat(40))
  .find(check => check.name === 'Only approved staging build contexts and image pull policies')?.passed;

test('S49 accepts image-only staging model and approved local application builds', () => {
  assert.equal(safe(fixture()), true);
  const services = fixture();
  services.api.build = { context: root, dockerfile: 'apps/api/Dockerfile' };
  services.web.build = { context: root, dockerfile: 'apps/web/Dockerfile' };
  assert.equal(safe(services), true);
  assert.equal(checked(services), true);
});

test('S49 rejects external, parent and relative build contexts', () => {
  for (const context of ['/tmp/production', root + '/apps', '.', '../production', '/']) {
    const services = fixture();
    services.api.build = { context, dockerfile: 'apps/api/Dockerfile' };
    assert.equal(safe(services), false, context);
    assert.equal(checked(services), false, context);
  }
});

test('S49 rejects Dockerfile substitutions and build-time injection', () => {
  const variants = [
    { dockerfile: 'apps/api/production.Dockerfile' },
    { args: { SECRET: 'production' } }, { secrets: ['prod-token'] },
    { ssh: ['default'] }, { network: 'host' }, { privileged: true },
    { dockerfile_inline: 'FROM alpine' },
    { additional_contexts: { prod: '/mnt/prod' } }, { target: 'debug' },
    { cache_from: ['type=local,src=/mnt/prod'] },
  ];
  for (const variant of variants) {
    const services = fixture();
    services.api.build = { context: root, dockerfile: 'apps/api/Dockerfile', ...variant };
    assert.equal(safe(services), false, JSON.stringify(variant));
  }
});

test('S49 rejects infrastructure builds and unreviewed image pull policies', () => {
  for (const name of ['postgres', 'redis', 'staging-edge']) {
    const services = fixture(); services[name].build = { context: root, dockerfile: 'Dockerfile' };
    assert.equal(safe(services), false, name);
  }
  for (const name of names) {
    for (const pull_policy of ['always', 'build', 'missing', 'daily']) {
      const services = fixture(); services[name].pull_policy = pull_policy;
      assert.equal(safe(services), false, name + pull_policy);
      assert.equal(checked(services), false, name + pull_policy);
    }
  }
});

test('S49 accepts explicitly disabled pulls and blocks malformed build declarations', () => {
  const services = fixture();
  services.api.pull_policy = 'never';
  assert.equal(safe(services), true);
  for (const bad of ['.', null, [], { context: root }, { dockerfile: 'apps/api/Dockerfile' }]) {
    const model = fixture(); model.api.build = bad;
    assert.equal(safe(model), false, JSON.stringify(bad));
  }
});
