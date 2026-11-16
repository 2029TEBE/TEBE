/**
 * Disposable PostgreSQL 16 ONLY: worker single-use assignment acceptance.
 * Uses synthetic UUIDs and rollback-only writes; NEVER creates roles, schema,
 * permissions, migrations, or committed claim data.
 *
 * Prerequisites: locally installed, reviewed GAIZ draft schema + FORCE RLS,
 * a login exactly named gaiz_verify_worker (not owner/BYPASSRLS), INSERT and
 * SELECT(assignment_id) for that role, and two existing synthetic tenants.
 *
 * GAIZ_VERIFY_WORKER_DATABASE_URL=postgres://gaiz_verify_worker:...@127.0.0.1/gaiz_disposable_test \
 * GAIZ_TEST_TENANT_A=<uuid> GAIZ_TEST_TENANT_B=<uuid> \
 * node --test packages/db/src/gaiz-worker-replay-acceptance.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { validateGaizDisposableConfig } from './gaiz-disposable-config.mjs';

const url=process.env.GAIZ_VERIFY_WORKER_DATABASE_URL;
const tenantA=process.env.GAIZ_TEST_TENANT_A;
const tenantB=process.env.GAIZ_TEST_TENANT_B;
const config=()=>validateGaizDisposableConfig({url,tenantA,tenantB});
const mustRole=async db=>{
  const [identity]=await db`SELECT current_database() AS db_name, current_user AS role,
    rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`;
  assert.match(identity.db_name,/^gaiz_(?:disposable|test)/i);
  assert.equal(identity.role,'gaiz_verify_worker');
  assert.equal(identity.rolsuper,false);
  assert.equal(identity.rolbypassrls,false);
  const [grants]=await db`SELECT
    has_table_privilege(current_user,'public.gaiz_worker_assignment_claims','INSERT') AS can_insert,
    has_column_privilege(current_user,'public.gaiz_worker_assignment_claims','assignment_id','SELECT') AS can_return_id,
    has_table_privilege(current_user,'public.gaiz_worker_assignment_claims','DELETE') AS can_delete`;
  assert.equal(grants.can_insert,true);
  assert.equal(grants.can_return_id,true);
  assert.equal(grants.can_delete,false);
};
const claim=async(tx,tenant,id,worker,workItem)=>{
  await tx`SELECT set_config('app.tenant_id',${tenant},true)`;
  const result=await tx`INSERT INTO gaiz_worker_assignment_claims
    (assignment_id,tenant_id,worker_id,work_item_id,purpose,expires_at)
    SELECT ${id},${tenant},${worker},${workItem},'gaiz_verify_worker',
      clock_timestamp()+interval '1 minute'
    ON CONFLICT (assignment_id) DO NOTHING RETURNING assignment_id`;
  return result;
};
const rollback=()=>{throw new Error('gaiz-disposable-rollback');};
const expectRollback=async fn=>assert.rejects(fn,/gaiz-disposable-rollback/);

test('one assignment can be claimed once, and a rollback releases it', {skip:!url}, async()=>{
  config();
  const db=postgres(url,{max:2,connect_timeout:5,prepare:false});
  try{
    await mustRole(db);
    const id=randomUUID(),worker=randomUUID(),item=randomUUID();
    await expectRollback(()=>db.begin(async tx=>{
      assert.equal((await claim(tx,tenantA,id,worker,item)).length,1);
      assert.equal((await claim(tx,tenantA,id,worker,item)).length,0);
      // Same ID cannot be reused for a different tenant or worker.
      assert.equal((await claim(tx,tenantB,id,worker,item)).length,0);
      rollback();
    }));
    await expectRollback(()=>db.begin(async tx=>{
      assert.equal((await claim(tx,tenantA,id,worker,item)).length,1);
      rollback();
    }));
  }finally{await db.end({timeout:2});}
});

test('competing transactions serialize one-time ID and rollback without residue', {skip:!url}, async()=>{
  config();
  const db=postgres(url,{max:2,connect_timeout:5,prepare:false});
  try{
    await mustRole(db);
    const id=randomUUID(),worker=randomUUID(),item=randomUUID();
    let signalFirst;
    const firstInserted=new Promise(resolve=>{signalFirst=resolve;});
    let signalRelease;
    const releaseFirst=new Promise(resolve=>{signalRelease=resolve;});
    const first=db.begin(async tx=>{
      assert.equal((await claim(tx,tenantA,id,worker,item)).length,1);
      signalFirst();
      await releaseFirst;
      rollback();
    });
    await firstInserted;
    let signalCompeting;
    const competingStarted=new Promise(resolve=>{signalCompeting=resolve;});
    const second=db.begin(async tx=>{
      signalCompeting();
      const result=await claim(tx,tenantA,id,worker,item);
      assert.equal(result.length,1,'rollback of first claim must release ID');
      rollback();
    });
    await competingStarted;
    // Give PostgreSQL a chance to block on the first uncommitted unique key.
    await new Promise(resolve=>setTimeout(resolve,100));
    signalRelease();
    await Promise.all([expectRollback(()=>first),expectRollback(()=>second)]);
    // A new transaction may claim the same ID after BOTH rolled back.
    await expectRollback(()=>db.begin(async tx=>{
      assert.equal((await claim(tx,tenantA,id,worker,item)).length,1);
      rollback();
    }));
  }finally{await db.end({timeout:2});}
});
