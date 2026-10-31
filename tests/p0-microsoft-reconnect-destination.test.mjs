import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../apps/api/src/microsoft/microsoft.service.ts', import.meta.url), 'utf8');
const callback = source.slice(source.indexOf('async completeConnect('), source.indexOf('async disconnect('));
const upsert = callback.slice(callback.indexOf('ON CONFLICT (tenant_id, provider) DO UPDATE SET'),
  callback.indexOf('WHERE integration_connections.connected_by = EXCLUDED.connected_by'));

test('reconnect clears all seven Graph destinations unless both account and tenant match', () => {
  const fields = ['site_id', 'site_name', 'site_url', 'drive_id', 'drive_name',
    'root_item_id', 'root_path'];
  for (const field of fields) {
    const match = upsert.match(new RegExp('\\b' + field +
      ' = CASE WHEN ([\\s\\S]*?) THEN integration_connections\\.' + field + ' ELSE NULL END,'));
    assert.ok(match, 'missing fail-closed reset for ' + field);
    const condition = match[1];
    assert.match(condition, /EXCLUDED\.external_tenant_id IS NOT NULL/);
    assert.match(condition, /EXCLUDED\.account_email IS NOT NULL/);
    assert.match(condition, /integration_connections\.external_tenant_id = EXCLUDED\.external_tenant_id/);
    assert.match(condition, /lower\(integration_connections\.account_email\) = lower\(EXCLUDED\.account_email\)/);
  }
});

test('OAuth owner lock, credential replacement and conflict guard remain in place', () => {
  assert.match(callback, /FOR SHARE OF m/);
  assert.match(callback, /WHERE integration_connections\.connected_by = EXCLUDED\.connected_by/);
  assert.match(upsert, /refresh_token = EXCLUDED\.refresh_token/);
  assert.match(callback, /ON CONFLICT \(tenant_id, provider\) DO UPDATE SET/);
});
