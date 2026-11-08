import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveVerifiedSandboxPrice as resolve } from './paddle-verified-sandbox-catalog.mjs';

const env = () => ({ deploymentEnv: 'staging', paddleEnv: 'sandbox',
  paddleEnabled: 'false', billingProvider: 'paddle' });

test('uses exact Paddle dashboard-verified price and product, USD 49/month', () => {
  const result = resolve('team_workspace_monthly', env());
  assert.equal(result.ok, true);
  assert.equal(result.productId, 'pro_01m6x789k8kmvez6zk7cm17wdz');
  assert.equal(result.paddlePriceId, 'pri_01m6x7w5zy16nktzjwg2ezas2d');
  assert.equal(result.amountMinor, 4900);
  assert.equal(result.currency, 'USD');
  assert.equal(result.interval, 'month');
  assert.equal(result.frequency, 1);
  assert.equal(result.collectionEnabled, false);
  assert.equal(result.entitlementGranted, false);
});

test('unknown plan, caller-selected Paddle IDs and price overrides cannot resolve', () => {
  for (const key of ['', 'enterprise', 'pri_01m6x7w5zy16nktzjwg2ezas2d',
    'team_workspace_monthly?price=1', null, { planKey: 'team_workspace_monthly' }]) {
    assert.equal(resolve(key, env()).ok, false);
  }
});

test('fail closed for missing environment, production or payment enablement', () => {
  for (const patch of [
    { deploymentEnv: 'production' }, { deploymentEnv: undefined },
    { paddleEnv: 'production' }, { paddleEnv: undefined },
    { billingProvider: 'stripe' }, { paddleEnabled: 'true' },
    { paddleEnabled: undefined },
  ]) {
    const result = resolve('team_workspace_monthly', { ...env(), ...patch });
    assert.equal(result.ok, false);
    assert.equal(result.collectionEnabled, false);
    assert.equal(result.entitlementGranted, false);
  }
});

test('catalog values are immutable and cannot activate collection', () => {
  const result = resolve('team_workspace_monthly', env());
  assert.equal(Object.isFrozen(result), true);
  assert.throws(() => { result.amountMinor = 1; }, TypeError);
  assert.throws(() => { result.collectionEnabled = true; }, TypeError);
});
