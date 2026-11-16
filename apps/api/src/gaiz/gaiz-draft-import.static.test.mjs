import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const dir=dirname(fileURLToPath(import.meta.url));
const src=readFileSync(resolve(dir,'gaiz-draft-import.executor.ts'),'utf8');
const migration=readFileSync(resolve(dir,'../../../../docs/gaiz/PROPOSED_ADDITIVE_SCHEMA.sql'),'utf8');
const rls=readFileSync(resolve(dir,'../../../../docs/gaiz/PROPOSED_RLS_REVIEW.sql'),'utf8');
const app=readFileSync(resolve(dir,'../app.module.ts'),'utf8');

test('draft executor remains disconnected from production app',()=>{
  assert.doesNotMatch(app,/GaizEnterpriseCandidateModule|GaizDraftImportExecutor/);
  assert.match(src,/NODE_ENV === 'production'/);
  assert.match(src,/GAIZ_DEV_ONLY !== 'true'/);
  assert.match(src,/requireCapability\('pmoa_manage_projects'\)/);
});
test('draft import depends on persisted approval, provenance, row lock and tenant isolation',()=>{
  for(const pattern of [
    /withTenant\(tenantId/,/FOR UPDATE OF j/,/gaiz_decisions/,
    /approved_by AS "approvedBy"/,/state!=='approved'/,
    /content_integrity_verified_at/,/gaiz_import_proposals/,
    /envelopeSha!==job.quarantineSha/,/mapping\.sourceSha!==job\.envelopeSha/,
    /gaiz_import_receipts/,/auditEvents/,
    /'draft'::doc_status/,/state='imported'/,
  ])assert.match(src,pattern);
});
test('draft proposal and receipt are tenant-scoped and never executable migrations',()=>{
  assert.match(migration,/CREATE TABLE (?:IF NOT EXISTS )?gaiz_import_proposals/);
  assert.match(migration,/CREATE TABLE (?:IF NOT EXISTS )?gaiz_import_receipts/);
  assert.match(migration,/UNIQUE \(tenant_id, import_id\)/);
  for(const table of ['gaiz_import_proposals','gaiz_import_receipts']){
    assert.match(rls,new RegExp('ALTER TABLE '+table+' FORCE ROW LEVEL SECURITY'));
    assert.match(rls,new RegExp('CREATE POLICY tenant_isolation ON '+table));
  }
});
