import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const migration=read('../../../../../packages/db/migrations/0021_gaiz_custody_attempts.sql');
const roles=read('../../../../../packages/db/sql/rls.sql');
const handoff=read('./gaiz-custody-handoff.service.ts');
const store=read('./gaiz-custody-attempts.service.ts');
const controller=read('./gaiz.controller.ts');
test('durable custody reservations are RLS tenant-bound and one-use',()=>{
 assert.match(migration,/UNIQUE\s*\(tenant_id,\s*review_id\)/);
 assert.match(migration,/FOREIGN KEY\s*\(tenant_id,review_id\)/);
 assert.match(migration,/FORCE ROW LEVEL SECURITY/);
 assert.match(migration,/CHECK \(status IN \('reserved','validated','denied'\)\)/);
 assert.match(store,/onConflictDoNothing\(\)/);
 assert.match(store,/eq\(gaizCustodyAttempts.status,'reserved'\)/);
 assert.match(store,/gaiz.custody.reserved/);
 assert.match(store,/gaiz.custody.validated/);
});
test('custody role cannot delete or rewrite request and attempt identity',()=>{
 assert.match(roles,/REVOKE DELETE ON public.gaiz_custody_attempts FROM pmo_app/);
 assert.match(roles,/GRANT UPDATE \(status, report_sha256, completed_at\)/);
 assert.match(roles,/REVOKE UPDATE ON public.gaiz_custody_attempts/);
 assert.match(roles,/DO \$\$ BEGIN/);
 assert.doesNotMatch(roles,/DO \$ BEGIN/);
});
test('custodian bridge is internal-only and refuses production',()=>{
 assert.match(handoff,/GAIZ_CUSTODY_BRIDGE_ENABLED !== 'true'/);
 assert.match(handoff,/NODE_ENV !== 'development'/);
 assert.match(store,/NODE_ENV !== 'development'/);
 assert.doesNotMatch(controller,/custody|decrypt|import\/apply/i);
});
