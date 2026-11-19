import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../../../../packages/db/'+p,import.meta.url),'utf8');
const boot=src('sql/tests/ao-isolated-bootstrap.sql');
const assertions=src('sql/tests/ao-isolated-assertions.sql');
const smoke=src('scripts/ao-isolated-smoke.sh');
const concurrency=src('scripts/ao-isolated-concurrency.sh');
test('AO database fixture is scoped to a fresh disposable database and never a migration',()=>{
 assert.match(boot,/current_database\(\)<>'ao_ci_isolated'/);
 assert.match(boot,/to_regclass\('public\.ao_task_reservations'\) IS NOT NULL/);
 assert.match(boot,/CREATE ROLE ao_ci_app NOLOGIN.*NOBYPASSRLS/);
 assert.match(boot,/PRIMARY KEY \(tenant_id,request_hash\)/);
 assert.match(boot,/ENABLE ROW LEVEL SECURITY/);
 assert.match(boot,/FORCE ROW LEVEL SECURITY/);
 assert.match(boot,/WITH CHECK \(tenant_id=ao_ci_current_tenant\(\)\)/);
 assert.match(boot,/GRANT SELECT,INSERT ON TABLE public\.ao_task_reservations TO ao_ci_app/);
 assert.doesNotMatch(boot,/GRANT.*(?:UPDATE|DELETE).*ao_ci_app/);
});
test('AO assertions cover missing tenant context, cross-tenant writes and privileged state',()=>{
 assert.match(assertions,/AO tenantless read leaked reservations/);
 assert.match(assertions,/AO cross-tenant write accepted/);
 assert.match(assertions,/AO tenant-1 read violated tenant boundary/);
 assert.match(assertions,/AO tenant-2 read violated isolation/);
 assert.match(assertions,/AO duplicate nonce created another reservation/);
 assert.match(assertions,/AO client forged approved reservation/);
});
test('AO two-session fixture uses a lock timeout and proves exact nonce uniqueness',()=>{
 assert.match(concurrency,/PGAPPNAME=ao_ci_holder/);
 assert.match(concurrency,/lock_timeout='250ms'/);
 assert.match(concurrency,/ON CONFLICT \(tenant_id,request_hash\) DO NOTHING/);
 assert.match(concurrency,/AO duplicate nonce created a second reservation/);
 assert.match(concurrency,/AO tenant-2 read tenant-1 concurrent reservation/);
});
test('AO smoke runner refuses all nonlocal, unacknowledged and production-like targets',()=>{
 for(const source of [smoke,concurrency]){
  assert.match(source,/AO_TEST_DB_ACK/);
  assert.match(source,/DISPOSABLE_DB_ONLY/);
  assert.match(source,/127\.0\.0\.1/);
  assert.match(source,/ao_ci_isolated/);
  assert.match(source,/5433/);
  assert.match(source,/PGUSER/);
 }
 assert.match(smoke,/ao-isolated-bootstrap.sql/);
 assert.match(smoke,/ao-isolated-assertions.sql/);
 assert.match(smoke,/ao-isolated-concurrency.sh/);
});

test('restricted AO adapter proof is gated on real disposable PostgreSQL CI',()=>{
 assert.ok(boot.includes('CREATE ROLE ao_ci_client LOGIN INHERIT'));
 assert.ok(boot.includes('GRANT ao_ci_app TO ao_ci_client'));
 assert.ok(boot.includes('CREATE TABLE public.ao_ci_actor_rights'));
 assert.ok(boot.includes('FORCE ROW LEVEL SECURITY'));
 assert.ok(boot.includes('GRANT SELECT ON public.ao_ci_actor_rights TO ao_ci_app'));
 assert.ok(!boot.includes('GRANT UPDATE ON public.ao_ci_actor_rights TO ao_ci_app'));
 const workflow=readFileSync(new URL('../../../../.github/workflows/ao-isolated-postgres.yml',import.meta.url),'utf8');
 assert.ok(workflow.includes('pnpm install --frozen-lockfile'));
 assert.ok(workflow.includes('pnpm --dir packages/db exec node scripts/ao-review-reservation.integration.mjs'));
 const adapter=src('scripts/ao-review-reservation.integration.mjs');
 for(const requirement of ['AO_TEST_DB_ACK','app.reserve()','createAoReviewReservation','parallel.map','postrevoke'])
  assert.ok(adapter.includes(requirement),'AO acceptance missing '+requirement);
});
