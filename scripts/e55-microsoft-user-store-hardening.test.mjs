import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const store = read('../apps/api/src/microsoft/user-connection-store.ts');
const service = read('../apps/api/src/microsoft/microsoft.service.ts');
const migration = read('../packages/db/migrations/0022_microsoft_user_owner_rls.sql');
const journal = JSON.parse(read('../packages/db/migrations/meta/_journal.json'));
const manifest = JSON.parse(read('../packages/db/migrations/meta/_sha256.json'));

test('E55 owner-scoped DAO is dormant and never silently migrates legacy connections', () => {
  assert.match(store, /if \(!microsoftUserStorePreviewEnabled\(\)\)/);
  assert.doesNotMatch(service, /from '\.\/user-connection-store'/);
  assert.doesNotMatch(store, /(?:INSERT INTO|UPDATE|DELETE FROM)\s+integration_connections/);
  assert.match(store, /set_config\('app\.user_id', \$\{userId\}, true\)/);
});

test('E55 owner gate locks active user and membership for every operation', () => {
  assert.match(store, /JOIN users AS u ON u\.id = m\.user_id/);
  assert.match(store, /m\.is_active = true AND u\.is_active = true/);
  assert.match(store, /FOR SHARE OF m, u/);
  assert.match(migration, /AS RESTRICTIVE FOR ALL/);
  assert.match(migration, /current_setting\('app\.user_id', true\)/);
});

test('E55 reconnection cannot carry destinations or scopes across Microsoft identities', () => {
  assert.match(store, /EXCLUDED\.external_tenant_id/);
  assert.match(store, /lower\(microsoft_user_connections\.account_email\) = lower\(EXCLUDED\.account_email\)/);
  for (const column of ['scopes','site_id','site_name','site_url','drive_id','drive_name','root_item_id','root_path','connected_at'])
    assert.match(store, new RegExp(column + ' = CASE WHEN'));
  assert.match(store, /ELSE EXCLUDED\.scopes END/);
  assert.match(store, /ELSE NULL END/g);
});

test('E55 folder writes are credential-CAS bound; revocation removes ciphertext', () => {
  assert.match(store, /expectedSealedToken: string,\s+location:/);
  assert.match(store, /AND refresh_token = \$\{expectedSealedToken\}/g);
  assert.match(store, /SET status = 'error', refresh_token = NULL/);
  assert.match(store, /AND status = 'connected'\s+AND refresh_token = \$\{expectedSealedToken\}/);
});

test('E55 migration ledger is strictly append-only and preserves C28', () => {
  assert.equal(journal.entries.at(-1)?.tag, '0022_microsoft_user_owner_rls');
  assert.equal(journal.entries.at(-1)?.idx, 22);
  assert.equal(journal.entries[21]?.tag, '0021_stripe_recurring_ledger');
  assert.equal(manifest.files['0022_microsoft_user_owner_rls.sql'],
    '84e2a1c90349c27eecf65f2b43bfc505fc2559db5c13a12f95d6faf5e8435f29');
});
