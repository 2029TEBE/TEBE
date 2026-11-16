import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const sql=read('../../../../packages/db/migrations/0022_gaiz_import_authorizations.sql');
const roles=read('../../../../packages/db/sql/rls.sql');
const service=read('./gaiz-import-authorization.service.ts');
const controller=read('./gaiz.controller.ts');
test('second import approval is tenant-bound, unique, expiry-limited and never a write',()=>{
 assert.match(sql,/UNIQUE\(tenant_id,staging_review_id\)/);
 assert.match(sql,/FOREIGN KEY \(tenant_id,staging_review_id\)/);
 assert.match(sql,/FOREIGN KEY \(tenant_id,staging_review_id,custody_attempt_id\)/);
 assert.match(sql,/FORCE ROW LEVEL SECURITY/);
 assert.match(sql,/approved_by <> requested_by/);
 assert.doesNotMatch(sql,/CREATE TRIGGER.*projects|UPDATE public\.projects|UPDATE public\.portfolios/i);
});
test('import authorization identity and preview hashes cannot be updated by app role',()=>{
 assert.match(roles,/REVOKE UPDATE ON public.gaiz_import_authorizations FROM pmo_app/);
 assert.match(roles,/GRANT UPDATE \(status, approved_by, reviewed_at\)/);
 assert.match(roles,/REVOKE DELETE ON public.gaiz_import_authorizations/);
});
test('review operations are atomic, audited and cannot approve own request or stage requester',()=>{
 assert.match(service,/NODE_ENV !== 'development'/);
 assert.match(service,/GAIZ_IMPORT_REVIEW_ENABLED !== 'true'/);
 assert.match(service,/ne\(gaizImportAuthorizations.requestedBy,userId\)/);
 assert.match(service,/origin.requestedBy===userId/);
 assert.match(service,/gt\(gaizImportAuthorizations.expiresAt,new Date\(\)\)/);
 assert.match(service,/onConflictDoNothing\(\)/);
 assert.match(service,/gaiz.import_review.approved/);
 assert.match(service,/approvedForWrite:false/);
 assert.match(service,/importAllowed:false/);
 assert.doesNotMatch(controller,/@Post\('import|@Post\('apply|@Post\('execute/);
});
