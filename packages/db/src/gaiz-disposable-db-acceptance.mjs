/**
 * Opt-in enterprise GAIZ PostgreSQL RLS acceptance gate.
 *
 * Intentionally SAFE and fail-closed: requires a dedicated disposable DB URL,
 * a clearly named isolated database, and two pre-existing synthetic tenants.
 * Never applies migrations or changes roles. It performs only synthetic
 * rollback-only audit writes; all must disappear after rollback.
 *
 * Run explicitly after local disposable schema and RLS setup:
 *   GAIZ_DISPOSABLE_DATABASE_URL=postgres://.../gaiz_disposable_test \
 *   GAIZ_TEST_TENANT_A=<uuid> GAIZ_TEST_TENANT_B=<uuid> \
 *   node --test packages/db/src/gaiz-disposable-db-acceptance.mjs
 *
 * Do NOT put this script in default CI until a disposable DB exists.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { validateGaizDisposableConfig } from './gaiz-disposable-config.mjs';

const env=process.env;
const url=env.GAIZ_DISPOSABLE_DATABASE_URL;
const tenantA=env.GAIZ_TEST_TENANT_A;
const tenantB=env.GAIZ_TEST_TENANT_B;
const checkConfig=()=>validateGaizDisposableConfig({url,tenantA,tenantB});

test('GAIZ disposable DB: RLS and ciphertext privilege acceptance', {skip:!url}, async()=>{
  checkConfig();
  const db=postgres(url,{max:2,connect_timeout:5,prepare:false});
  try{
    const [identity]=await db`SELECT current_database() AS db,
      current_user AS user_name,
      rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`;
    assert.match(identity.db,/^gaiz_(disposable|test)/i);
    assert.equal(identity.rolsuper,false,'must not run under superuser');
    assert.equal(identity.rolbypassrls,false,'must not run with BYPASSRLS');
    assert.notEqual(identity.user_name,'postgres');

    // Verify *all* GAIZ tables are protected and owner bypass is disabled.
    const tableNames=['gaiz_artifacts','gaiz_quarantine_blobs',
      'gaiz_import_jobs','gaiz_export_jobs','gaiz_decisions',
      'gaiz_import_proposals','gaiz_import_receipts','gaiz_worker_assignment_claims'];
    const tables=await db`SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ${db(tableNames)}`;
    assert.equal(tables.length,tableNames.length,'all proposed GAIZ tables must exist');
    for(const row of tables){
      assert.equal(row.relrowsecurity,true,row.relname+' lacks RLS');
      assert.equal(row.relforcerowsecurity,true,row.relname+' lacks FORCE RLS');
    }

    // Tenant-specific policies must actually exist, not merely RLS flags.
    const policies=await db`SELECT tablename, policyname, qual, with_check
      FROM pg_policies WHERE schemaname='public' AND tablename IN ${db(tableNames)}
        AND policyname='tenant_isolation'`;
    assert.equal(policies.length,tableNames.length,'missing tenant isolation policy');
    for(const policy of policies){
      assert.match(policy.qual??'',/app_current_tenant\(\)/);
      assert.match(policy.with_check??'',/app_current_tenant\(\)/);
    }

    // Current application role must NOT SELECT ciphertext or forge trusted
    // mapping rows. Statements below should work with restricted privileges.
    const [privs]=await db`SELECT
      has_column_privilege(current_user,'public.gaiz_quarantine_blobs','envelope_bytes','SELECT') AS can_read_ciphertext,
      has_table_privilege(current_user,'public.gaiz_artifacts','INSERT') AS can_forge_artifact,
      has_table_privilege(current_user,'public.gaiz_artifacts','UPDATE') AS can_rewrite_artifact,
      has_table_privilege(current_user,'public.gaiz_import_proposals','DELETE') AS can_delete_proposal,
      has_table_privilege(current_user,'public.gaiz_import_receipts','INSERT') AS can_forge_receipt,
      has_table_privilege(current_user,'public.gaiz_import_proposals','INSERT') AS can_forge_proposal,
      has_table_privilege(current_user,'public.gaiz_import_proposals','UPDATE') AS can_rewrite_proposal,
      has_table_privilege(current_user,'public.gaiz_import_receipts','UPDATE') AS can_rewrite_receipt,
      has_table_privilege(current_user,'public.gaiz_decisions','DELETE') AS can_delete_decision,
      has_table_privilege(current_user,'public.gaiz_worker_assignment_claims','INSERT') AS can_forge_worker_claim,
      has_table_privilege(current_user,'public.gaiz_worker_assignment_claims','SELECT') AS can_read_worker_claim`;
    for(const [name,value] of Object.entries(privs))
      assert.equal(value,false,'unsafe privilege '+name+' must be denied');

    // A client API login must never inherit the verifier/executor worker role,
    // including indirectly through role membership. Missing future roles do
    // not count as a failure, but inheritance must be denied if they exist.
    const workerRoles=await db`SELECT rolname FROM pg_roles
      WHERE rolname IN ('gaiz_verify_worker','gaiz_execute_worker')`;
    for(const role of workerRoles){
      const [grant]=await db`SELECT pg_has_role(current_user,${role.rolname},'MEMBER') AS member`;
      assert.equal(grant.member,false,'interactive app role inherits '+role.rolname);
    }

    // No tenant-scoped data can be queried with missing tenant setting.
    await db.begin(async tx=>{
      await tx`SELECT set_config('app.tenant_id','',true)`;
      const [a]=await tx`SELECT count(*)::int AS n FROM gaiz_import_jobs`;
      const [b]=await tx`SELECT count(*)::int AS n FROM gaiz_quarantine_blobs`;
      assert.equal(a.n,0);
      assert.equal(b.n,0);
    });

    // A and B may only observe their own synthetic tenant rows. The test
    // requires seeded fixtures so empty databases cannot produce false passes.
    for(const tenant of [tenantA,tenantB]){
      await db.begin(async tx=>{
        await tx`SELECT set_config('app.tenant_id',${tenant},true)`;
        const [imports]=await tx`SELECT count(*)::int AS n FROM gaiz_import_jobs
          WHERE tenant_id <> ${tenant}`;
        const [quarantine]=await tx`SELECT count(*)::int AS n FROM gaiz_quarantine_blobs
          WHERE tenant_id <> ${tenant}`;
        assert.equal(imports.n,0);
        assert.equal(quarantine.n,0);
        const [visible]=await tx`SELECT count(*)::int AS n
          FROM gaiz_import_jobs WHERE tenant_id=${tenant}`;
        assert.ok(visible.n>=1,'missing seeded GAIZ job for '+tenant);
      });
    }
  }finally{
    await db.end({timeout:2});
  }
});


test('GAIZ disposable DB: rollback and cross-tenant audit writes', {skip:!url}, async()=>{
  checkConfig();
  const db=postgres(url,{max:2,connect_timeout:5,prepare:false});
  const auditId=randomUUID();
  try{
    const [identity]=await db`SELECT current_database() AS db,
      current_user AS user_name, rolsuper, rolbypassrls
      FROM pg_roles WHERE rolname=current_user`;
    assert.match(identity.db,/^gaiz_(disposable|test)/i);
    assert.equal(identity.rolsuper,false);
    assert.equal(identity.rolbypassrls,false);
    // Test RLS by deliberately attempting a cross-tenant insert into the
    // existing append-only audit ledger: must fail with tenant A context.
    await assert.rejects(()=>db.begin(async tx=>{
      await tx`SELECT set_config('app.tenant_id',${tenantA},true)`;
      await tx`INSERT INTO audit_events (tenant_id, entity, entity_id, action)
        VALUES (${tenantB},'gaiz_disposable_test',${auditId},'gaiz.test_cross_tenant')`;
    }));
    // A valid tenant A insert in a transaction that deliberately aborts must
    // not survive rollback. This exercises the actual database transaction.
    const rollbackId=randomUUID();
    await assert.rejects(()=>db.begin(async tx=>{
      await tx`SELECT set_config('app.tenant_id',${tenantA},true)`;
      await tx`INSERT INTO audit_events (tenant_id, entity, entity_id, action)
        VALUES (${tenantA},'gaiz_disposable_test',${rollbackId},'gaiz.test_rollback')`;
      throw new Error('intentional GAIZ acceptance rollback');
    }),/intentional GAIZ acceptance rollback/);
    await db.begin(async tx=>{
      await tx`SELECT set_config('app.tenant_id',${tenantA},true)`;
      const [count]=await tx`SELECT count(*)::int AS n FROM audit_events
        WHERE entity_id=${rollbackId} OR entity_id=${auditId}`;
      assert.equal(count.n,0,'rollback/cross-tenant write persisted unexpectedly');
    });
  }finally{
    await db.end({timeout:2});
  }
});
