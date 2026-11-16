import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fingerprintGaizTarget} from './gaiz-import-authorization.mjs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const sql=read('../../../../packages/db/migrations/0023_gaiz_entity_revisions.sql');
const schema=read('../../../../packages/db/src/schema.ts');
const service=read('./gaiz-snapshot.service.ts');
const moduleSource=read('./gaiz.module.ts');
const controller=read('./gaiz.controller.ts');
const t='11111111-1111-4111-8111-111111111111';
const id='22222222-2222-4222-8222-222222222222';

test('migration increments revisions for every update, guarded against overflow',()=>{
 assert.match(sql,/ALTER TABLE public\.projects[\s\S]*ADD COLUMN revision integer NOT NULL DEFAULT 0/);
 assert.match(sql,/ALTER TABLE public\.portfolios[\s\S]*ADD COLUMN revision integer NOT NULL DEFAULT 0/);
 assert.match(sql,/BEFORE UPDATE ON public\.projects/);
 assert.match(sql,/BEFORE UPDATE ON public\.portfolios/);
 assert.match(sql,/NEW\.revision := OLD\.revision \+ 1/);
 assert.match(sql,/OLD\.revision >= 2147483647/);
 assert.match(schema,/export const projects = [\s\S]*?revision: integer\('revision'\)\.notNull\(\)\.default\(0\)/);
 assert.match(schema,/export const portfolios = [\s\S]*?revision: integer\('revision'\)\.notNull\(\)\.default\(0\)/);
});
test('snapshot service uses tenant RLS and never publishes plaintext over HTTP',()=>{
 assert.match(service,/withTenant\(tenantId/);
 assert.match(service,/eq\(projects\.tenantId, tenantId\)/);
 assert.match(service,/eq\(portfolios\.tenantId, tenantId\)/);
 assert.match(service,/GAIZ_SNAPSHOT_PREVIEW_ENABLED !== 'true'/);
 assert.match(service,/NODE_ENV !== 'development'/);
 assert.match(service,/fingerprintGaizTarget\(snapshot\)/);
 assert.match(service,/current\.snapshot\.revision !== expectedRevision/);
 assert.match(service,/current\.targetSnapshotSha256 !== expectedFingerprint/);
 assert.match(moduleSource,/GaizSnapshotService/);
 assert.doesNotMatch(controller,/@Get\('snapshot|@Post\('snapshot/);
});
test('same snapshot hash changes for revision or field change even when both are valid',()=>{
 const p={kind:'project',id,tenantId:t,revision:0,fields:{name:'Original'}};
 const original=fingerprintGaizTarget(p);
 assert.match(original,/^[a-f0-9]{64}$/);
 assert.notEqual(original,fingerprintGaizTarget({...p,revision:1}));
 assert.notEqual(original,fingerprintGaizTarget({...p,fields:{name:'Changed'}}));
 assert.throws(()=>fingerprintGaizTarget({...p,tenantId:'other'}));
 assert.throws(()=>fingerprintGaizTarget({...p,revision:-1}));
 const portfolio={kind:'portfolio',id,tenantId:t,revision:0,fields:{description:null}};
 assert.match(fingerprintGaizTarget(portfolio),/^[a-f0-9]{64}$/);
});
