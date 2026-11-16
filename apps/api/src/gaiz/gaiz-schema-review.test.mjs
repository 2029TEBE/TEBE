import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const dir=dirname(fileURLToPath(import.meta.url));
const sql=readFileSync(resolve(dir,'../../../../docs/gaiz/PROPOSED_ADDITIVE_SCHEMA.sql'),'utf8');
const policy=readFileSync(resolve(dir,'../../../../docs/gaiz/PROPOSED_RLS_REVIEW.sql'),'utf8');
const tables=['gaiz_quarantine_blobs','gaiz_artifacts','gaiz_import_jobs',
  'gaiz_import_proposals','gaiz_import_receipts','gaiz_export_jobs','gaiz_decisions',
  'gaiz_worker_assignment_claims'];

test('candidate SQL proposal has exactly one complete CREATE for each GAIZ table',()=>{
  assert.match(sql,/REVIEW-ONLY PROPOSAL: DO NOT APPLY AS A MIGRATION/);
  for(const table of tables) {
    const matches=sql.match(new RegExp('CREATE TABLE '+table+'\\s*\\(', 'g'))??[];
    assert.equal(matches.length,1,table+' must have exactly one definition');
    assert.match(policy,new RegExp('ALTER TABLE '+table+' FORCE ROW LEVEL SECURITY'));
  }
  const creates=sql.match(/CREATE TABLE gaiz_[a-z_]+\s*\(/g)??[];
  assert.equal(creates.length,tables.length);
});

test('quarantine failures can be recorded without asserting successful verification',()=>{
  assert.match(sql,/state IN \('quarantined','rejected','failed'\) OR artifact_ref IS NOT NULL/);
  assert.match(sql,/state NOT IN \('approved','importing','imported'\) OR approved_by IS NOT NULL/);
  assert.match(sql,/UNIQUE \(tenant_id, idempotency_key\)/);
  assert.match(sql,/UNIQUE \(tenant_id, import_id\)/);
});

test('business references bind to the same tenant by composite foreign keys',()=>{
  assert.match(sql,/CREATE UNIQUE INDEX projects_id_tenant_gaiz_fk ON projects \(id, tenant_id\)/);
  assert.match(sql,/CREATE UNIQUE INDEX documents_id_tenant_gaiz_fk ON documents \(id, tenant_id\)/);
  assert.match(sql,/FOREIGN KEY \(target_project_id, tenant_id\)\s+REFERENCES projects\(id, tenant_id\)/);
  assert.match(sql,/FOREIGN KEY \(document_id, tenant_id\)\s+REFERENCES documents\(id, tenant_id\)/);
});

test('untrusted application role is denied evidence forgery',()=>{
  assert.match(policy,/REVOKE INSERT, UPDATE, DELETE ON gaiz_import_proposals FROM pmo_app/);
  assert.match(policy,/REVOKE INSERT, UPDATE, DELETE ON gaiz_artifacts FROM pmo_app/);
  assert.match(policy,/REVOKE INSERT ON gaiz_import_receipts FROM pmo_app/);
  assert.match(policy,/REVOKE SELECT ON gaiz_quarantine_blobs FROM pmo_app/);
  assert.match(policy,/REVOKE INSERT, UPDATE, DELETE ON gaiz_import_jobs FROM pmo_app/);
  assert.match(policy,/REVOKE INSERT, UPDATE, DELETE ON gaiz_decisions FROM pmo_app/);
  assert.match(policy,/dedicated executor role/i);
});
