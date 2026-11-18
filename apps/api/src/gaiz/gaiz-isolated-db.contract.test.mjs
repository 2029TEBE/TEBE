import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const db = p=>readFileSync(new URL('../../../../packages/db/'+p,import.meta.url),'utf8');
const a=db('migrations/0020_gaiz_import_staging.sql');
const b=db('migrations/0021_gaiz_custody_attempts.sql');
const c=db('migrations/0022_gaiz_import_authorizations.sql');
const d=db('migrations/0023_gaiz_entity_revisions.sql');
const grants=db('sql/rls.sql');
const boot=db('sql/tests/gaiz-isolated-bootstrap.sql');
const assertions=db('sql/tests/gaiz-isolated-assertions.sql');
const smoke=db('scripts/gaiz-isolated-smoke.sh');
const concurrency=db('scripts/gaiz-isolated-concurrency.sh');
test('all GAIZ migrations preserve tenant RLS and exact custody/review linkage',()=>{
 for(const sql of [a,b,c]) assert.match(sql,/FORCE ROW LEVEL SECURITY/);
 assert.match(b,/UNIQUE \(tenant_id, review_id\)/);
 assert.match(c,/FOREIGN KEY \(tenant_id,staging_review_id,custody_attempt_id\)/);
 assert.match(c,/REFERENCES public\.gaiz_custody_attempts\(tenant_id,review_id,id\)/);
 assert.match(d,/NEW\.revision := OLD\.revision \+ 1/);
 assert.match(d,/BEFORE UPDATE ON public\.projects/);
 assert.match(d,/BEFORE UPDATE ON public\.portfolios/);
});
test('GAIZ database role only inserts pending records and cannot overwrite hashes',()=>{
 for(const table of ['gaiz_import_requests','gaiz_custody_attempts','gaiz_import_authorizations']){
  assert.match(grants,new RegExp('REVOKE INSERT ON public\\.'+table+' FROM pmo_app'));
  assert.match(grants,new RegExp('REVOKE UPDATE ON public\\.'+table+' FROM pmo_app'));
  assert.match(grants,new RegExp('REVOKE DELETE ON public\\.'+table+' FROM pmo_app'));
 }
 assert.match(assertions,/has_column_privilege\('pmo_app','public\.gaiz_import_requests','status','INSERT'\)/);
 assert.match(assertions,/forged preapproved stage INSERT accepted/);
 assert.match(assertions,/unset tenant context leaked GAIZ requests/);
 assert.match(assertions,/cross-tenant GAIZ mutation accepted/);
 assert.match(assertions,/wrong custody\/stage pairing accepted/);
});
test('DB harness cannot target nonlocal or pre-existing production database',()=>{
 assert.match(smoke,/GAIZ_TEST_DB_ACK/);
 assert.match(smoke,/PGHOST/);
 assert.match(smoke,/127\.0\.0\.1/);
 assert.match(smoke,/PGDATABASE/);
 assert.match(smoke,/gaiz_ci_isolated/);
 assert.match(boot,/fresh gaiz_ci_isolated database/);
 assert.match(boot,/to_regclass\('public\.projects'\)/);
 assert.match(concurrency,/lock_timeout='250ms'/);
 assert.match(concurrency,/revision=0/);
 assert.match(concurrency,/stale compare-and-swap changed a project/);
});
