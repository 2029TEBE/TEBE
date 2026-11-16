import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir=dirname(fileURLToPath(import.meta.url));
const read=path=>readFileSync(resolve(dir,path),'utf8');
const claim=read('gaiz-assignment-claim.ts');
const assignment=read('gaiz-worker-assignment.mjs');
const ddl=read('../../../../docs/gaiz/PROPOSED_ADDITIVE_SCHEMA.sql');
const rls=read('../../../../docs/gaiz/PROPOSED_RLS_REVIEW.sql');
const app=read('../app.module.ts');

test('assignment claim is unregistered, production-disabled and needs a scoped transaction',()=>{
  assert.doesNotMatch(app,/GaizAssignmentClaim|gaiz-assignment-claim/);
  assert.match(claim,/NODE_ENV === 'production'/);
  assert.match(claim,/GAIZ_DEV_ONLY !== 'true'/);
  assert.match(claim,/tx: ScopedTransaction/);
  assert.match(claim,/current_setting\('app.tenant_id', true\)/);
  assert.match(claim,/identity.dbRole !== assignment.purpose/);
  assert.match(claim,/transport.workerId !== assignment.workerId/);
  assert.match(assignment,/databaseClaimRequired:true/);
});
test('unique single-use assignment ID and server-clock expiry prevent replay',()=>{
  assert.match(ddl,/CREATE TABLE gaiz_worker_assignment_claims/);
  assert.match(ddl,/assignment_id uuid PRIMARY KEY/);
  assert.match(ddl,/CHECK \(expires_at > claimed_at\)/);
  assert.match(claim,/ON CONFLICT \(assignment_id\) DO NOTHING/);
  assert.match(claim,/clock_timestamp\(\)/);
  assert.match(claim,/inserted.length !== 1/);
  assert.match(claim,/importAllowed: false/);
});
test('assignment claims are tenant-isolated and inaccessible to interactive API role',()=>{
  assert.match(rls,/ALTER TABLE gaiz_worker_assignment_claims FORCE ROW LEVEL SECURITY/);
  assert.match(rls,/CREATE POLICY tenant_isolation ON gaiz_worker_assignment_claims/);
  assert.match(rls,/REVOKE ALL ON gaiz_worker_assignment_claims FROM PUBLIC/);
  assert.match(rls,/REVOKE ALL ON gaiz_worker_assignment_claims FROM pmo_app/);
  assert.doesNotMatch(claim,/\.transaction\(/);
});
