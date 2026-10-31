import test from 'node:test';
import assert from 'node:assert/strict';
import { safeStagingContainerRuntime } from '../infra/staging/compose-runtime-boundary.mjs';
import { inspectResolvedStagingCompose } from '../infra/staging/verify-resolved-compose.mjs';

const names = ['postgres', 'redis', 'api', 'web', 'staging-edge'];
const fixture = () => ({
  postgres: {}, redis: {}, api: {}, web: {},
  'staging-edge': { cap_drop: ['ALL'], cap_add: ['SETUID', 'SETGID'],
    security_opt: ['no-new-privileges:true'], read_only: true },
});
const check = services => inspectResolvedStagingCompose({ services }, 'a'.repeat(40))
  .find(item => item.name === 'No staging container capability or namespace escape')?.passed;

test('S44 accepts approved read-only edge capabilities and rejects absent services', () => {
  assert.equal(safeStagingContainerRuntime(fixture()), true);
  assert.equal(check(fixture()), true);
  const missing = fixture(); delete missing.redis;
  assert.equal(safeStagingContainerRuntime(missing), false);
  assert.equal(check(missing), false);
});

test('S44 rejects extra Linux capabilities on every staging service', () => {
  for (const name of names) {
    const services = fixture(); services[name].cap_add = ['SYS_ADMIN'];
    assert.equal(check(services), false, name);
  }
  for (const bad of [['SETUID'], ['SETUID', 'SETGID', 'NET_ADMIN'],
    ['SETUID', 'SETUID'], ['setuid', 'SETGID']]) {
    const services = fixture(); services['staging-edge'].cap_add = bad;
    assert.equal(check(services), false, JSON.stringify(bad));
  }
});

test('S44 rejects unconfined profiles and disabled no-new-privileges', () => {
  for (const name of names) {
    for (const bad of ['seccomp=unconfined', 'apparmor=unconfined',
      'no-new-privileges:false']) {
      const services = fixture(); services[name].security_opt = [bad];
      assert.equal(check(services), false, name + ':' + bad);
    }
  }
});

test('S44 rejects cross-container and host namespace/runtime overrides', () => {
  for (const name of names) {
    for (const [field, value] of Object.entries({
      pid: 'service:postgres', ipc: 'host', uts: 'host', cgroup: 'host',
      cgroupns_mode: 'host', userns_mode: 'host', runtime: 'nvidia',
      sysctls: { 'net.ipv4.ip_forward': '1' }, group_add: ['docker'],
    })) {
      const services = fixture(); services[name][field] = value;
      assert.equal(check(services), false, name + ':' + field);
    }
  }
});

test('S44 requires least privilege when the edge retains SETUID/SETGID', () => {
  for (const [field, value] of [
    ['cap_drop', undefined], ['cap_drop', ['NET_RAW']],
    ['security_opt', undefined], ['security_opt', []],
    ['read_only', false],
  ]) {
    const services = fixture();
    if (value === undefined) delete services['staging-edge'][field];
    else services['staging-edge'][field] = value;
    assert.equal(check(services), false, field);
  }
});
