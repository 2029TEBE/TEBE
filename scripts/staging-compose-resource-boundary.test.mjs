import test from 'node:test';
import assert from 'node:assert/strict';
import { safeStagingResourceBoundary as safe } from '../infra/staging/compose-resource-boundary.mjs';
const fixture = () => ({
  volumes: { pgdata: { name: 'pmo-staging_pgdata' } },
  networks: { 'staging-data': { internal: true, name: 'pmo-staging_staging-data' },
    'staging-app': { name: 'pmo-staging_staging-app' } },
});
test('S48 approved synthetic project resources pass', () => assert.equal(safe(fixture()), true));
test('S48 volume driver_opts cannot redirect named volume to production bind mount', () => {
  const model = fixture(); model.volumes.pgdata.driver_opts = {
    type: 'none', o: 'bind', device: '/var/lib/production-postgres',
  };
  assert.equal(safe(model), false);
});
test('S48 rejects volume driver substitution and external volume', () => {
  for (const delta of [{ driver: 'local-persist' }, { external: true },
    { name: 'pmo-prod_pgdata' }, { driver_opts: { device: '/etc' } },
    { labels: { injected: 'yes' } }]) {
    const model = fixture(); Object.assign(model.volumes.pgdata, delta);
    assert.equal(safe(model), false, JSON.stringify(delta));
  }
});
test('S48 rejects network redirection, IPAM and driver substitutions', () => {
  for (const name of ['staging-data', 'staging-app']) {
    for (const delta of [{ name: 'pmo-prod_staging-data' }, { driver: 'macvlan' },
      { driver_opts: { parent: 'eth0' } }, { external: true },
      { ipam: { config: [{ subnet: '10.0.0.0/8' }] } },
      { attachable: true }, { enable_ipv6: true }, { labels: { x: 'y' } }]) {
      const model = fixture(); Object.assign(model.networks[name], delta);
      assert.equal(safe(model), false, name + JSON.stringify(delta));
    }
  }
});
test('S48 rejects removal of internal data isolation and unknown resources', () => {
  const a = fixture(); a.networks['staging-data'].internal = false; assert.equal(safe(a), false);
  const b = fixture(); b.volumes.other = {}; assert.equal(safe(b), false);
  const c = fixture(); c.networks.other = {}; assert.equal(safe(c), false);
});
