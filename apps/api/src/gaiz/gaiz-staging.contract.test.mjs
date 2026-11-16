import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source-level development safeguards; DB integration must be run on isolated
// PostgreSQL with RLS enabled before staging can be accepted for release.
const root = new URL('./', import.meta.url);
const service = readFileSync(new URL('gaiz-staging.service.ts', root), 'utf8');
const controller = readFileSync(new URL('gaiz.controller.ts', root), 'utf8');
const migration = readFileSync(new URL('../../../../packages/db/migrations/0020_gaiz_import_staging.sql', root), 'utf8');

test('GAIZ staging stores only signed metadata, without artifact bytes or keys', () => {
  for (const field of ['tenant_id','artifact_id','sha256','issuer_id','requested_by','reviewed_by','status']) {
    assert.match(migration, new RegExp('\\b'+field+'\\b'));
  }
  const tableColumns = migration.split('CREATE TABLE IF NOT EXISTS public.gaiz_import_requests (')[1]?.split(');')[0] ?? '';
  assert.ok(tableColumns.length > 0);
  assert.doesNotMatch(tableColumns,/ciphertext|plaintext|private_key|wrapped_key|data_encryption_key/i);
  assert.match(migration,/UNIQUE \(tenant_id, sha256\)/);
  assert.match(migration,/FORCE ROW LEVEL SECURITY/);
  assert.match(service,/onConflictDoNothing/);
});
test('GAIZ staging is local-development only and lacks an apply endpoint', () => {
  assert.match(service,/NODE_ENV !== 'development'/);
  assert.match(service,/GAIZ_STAGING_ENABLED !== 'true'/);
  assert.match(controller,/NODE_ENV !== 'development'/);
  assert.match(controller,/GAIZ_PREVIEW_ENABLED !== 'true'/);
  assert.doesNotMatch(controller,/@Post\(['"]apply|@Post\(['"]import/);
});
test('separation of duties, atomic review and audit events are coded', () => {
  assert.match(service,/ne\(gaizImportRequests.requestedBy, userId\)/);
  assert.match(service,/eq\(gaizImportRequests.status, 'pending'\)/);
  assert.match(service,/gt\(gaizImportRequests.expiresAt, new Date\(\)\)/);
  assert.match(service,/action: 'gaiz.stage.requested'/);
  assert.match(service,/action: decision === 'approved'/);
  assert.match(service,/importAllowed: false, appliesData: false/);
  assert.match(migration,/reviewed_by <> requested_by/);
});
