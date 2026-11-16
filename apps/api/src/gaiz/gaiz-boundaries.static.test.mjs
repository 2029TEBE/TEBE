import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir=dirname(fileURLToPath(import.meta.url));
const read=(path)=>readFileSync(resolve(dir,path),'utf8');
const app=read('../app.module.ts');
const orchestrator=read('gaiz-orchestrator.ts');
const exporter=read('gaiz-postgres.adapter.ts');
const executor=read('gaiz-draft-import.executor.ts');
const roles=read('../../../../docs/gaiz/WORKER_PERMISSION_BOUNDARIES.md');
const policy=read('../../../../docs/gaiz/PROPOSED_RLS_REVIEW.sql');

test('GAIZ remains unregistered and cannot be activated through an environment flag',()=>{
  assert.doesNotMatch(app,/GaizModule|GaizDraftImportExecutor|GaizQuarantinePostgres/);
  assert.match(orchestrator,/NODE_ENV === 'production'/);
  assert.match(executor,/NODE_ENV === 'production'/);
  assert.match(exporter,/Quarantine and artifact verification are not active/);
  assert.match(exporter,/GAIZ export persistence and delivery are not active/);
});

test('interactive application cannot forge verifier data or import receipts',()=>{
  for(const restriction of [
    /REVOKE INSERT, UPDATE, DELETE ON gaiz_import_proposals FROM pmo_app/,
    /REVOKE INSERT, UPDATE, DELETE ON gaiz_artifacts FROM pmo_app/,
    /REVOKE INSERT ON gaiz_import_receipts FROM pmo_app/,
    /REVOKE SELECT ON gaiz_quarantine_blobs FROM pmo_app/,
  ])assert.match(policy,restriction);
});

test('future verifier and executor are explicitly separated from interactive app role',()=>{
  assert.match(roles,/gaiz_verify_worker/);
  assert.match(roles,/gaiz_execute_worker/);
  assert.match(roles,/Never `GRANT gaiz_verify_worker TO pmo_app`/);
  assert.match(roles,/No automatic approval, merge or production deployment/);
  assert.match(roles,/single transaction|one transaction/i);
});
