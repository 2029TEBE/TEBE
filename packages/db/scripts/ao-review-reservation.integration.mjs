// Real PostgreSQL 16 adapter proof against a disposable *restricted login*.
// NEVER a production driver or authorization implementation; no AO routes/tools.
// This runs only in the dedicated ephemeral CI database.
import test from 'node:test';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import {createAoReviewReservation} from '../../../apps/api/src/gaiz/ao-review-reservation.mjs';

const expected={
 AO_TEST_DB_ACK:'DISPOSABLE_DB_ONLY',PGHOST:'127.0.0.1',
 PGPORT:'5433',PGDATABASE:'ao_ci_isolated',PGUSER:'postgres'
};
for(const [key,value] of Object.entries(expected)){
 if(process.env[key]!==value)throw Error('AO adapter acceptance requires disposable CI target');
}
const common={host:'127.0.0.1',port:5433,database:'ao_ci_isolated',
 connect_timeout:5,prepare:false,max:4};
const admin=postgres({...common,username:'postgres',password:process.env.PGPASSWORD});
const app=postgres({...common,username:'ao_ci_client',password:'ao_local_test_only_adapter_2026'});
// Convert postgres.js reserved connections into the injected Pool API.
// Must reserve one physical connection per BEGIN -> SET LOCAL tenant -> COMMIT.
const pool={async connect(){
 const c=await app.reserve();
 return {async query(statement,values=[]){
  const rows=await c.unsafe(statement,values);
  return {rows:[...rows]};
 },async release(){await c.release()}};
}};
const verifier=async(client,ctx)=>{
 const result=await client.query(
  `SELECT tenant_id AS "tenantId", principal_id AS "principalId",
     tool_id AS "toolId",risk,transport
    FROM public.ao_ci_actor_rights
    WHERE tenant_id=$1 AND principal_id=$2 AND tool_id=$3
      AND active=TRUE AND entitled=TRUE`,
  [ctx.tenantId,ctx.principalId,ctx.toolId]);
 const row=result.rows[0];
 return row?{verified:true,...row,executionSupported:false}:
  {verified:false,tenantId:ctx.tenantId,principalId:ctx.principalId,
   toolId:ctx.toolId,risk:'read',transport:'tebe_api',executionSupported:false};
};
const reserve=createAoReviewReservation({
 enabled:true,pool,verifyTrustedReadInTransaction:verifier
});
const tenantA='11111111-1111-4111-8111-111111111111';
const tenantB='22222222-2222-4222-8222-222222222222';
const make=(tenantId,principalId,requestId,taskId='taskid1234567890')=>({
 version:'1.0.0',tenantId,principalId,requestId,taskId,toolId:'ao.read',intent:{}
});
test('real restricted PostgreSQL adapter: two tenants, replays, denial and immutable pending state',async()=>{
 try{
  const roles=await admin`SELECT rolname, rolsuper, rolbypassrls FROM pg_roles
    WHERE rolname IN ('ao_ci_client','ao_ci_app')`;
  assert.equal(roles.length,2);
  assert.ok(roles.every(r=>!r.rolsuper&&!r.rolbypassrls));
  const [rights]=await admin`SELECT
    has_table_privilege('ao_ci_client','public.ao_task_reservations','SELECT') AS sel,
    has_table_privilege('ao_ci_client','public.ao_task_reservations','INSERT') AS ins,
    has_table_privilege('ao_ci_client','public.ao_task_reservations','UPDATE') AS upd,
    has_table_privilege('ao_ci_client','public.ao_task_reservations','DELETE') AS del,
    has_table_privilege('ao_ci_client','public.ao_ci_actor_rights','UPDATE') AS grantwrite`;
  assert.equal(rights.sel,true);assert.equal(rights.ins,true);
  assert.equal(rights.upd,false);assert.equal(rights.del,false);
  assert.equal(rights.grantwrite,false);
  const missingTenant=await app`SELECT count(*)::int AS n FROM public.ao_task_reservations`;
  assert.equal(missingTenant[0].n,0);

  const a=make(tenantA,'principal-a','integratednonce0001');
  const b=make(tenantB,'principal-b','integratednonce0001');
  const first=await reserve.reserve(a);
  assert.equal(first.status,'PENDING_REVIEW');
  assert.equal(first.replayed,false);
  assert.equal(first.executionSupported,false);
  assert.equal(first.grantIssued,false);
  const retry=await reserve.reserve(a);
  assert.equal(retry.replayed,true);
  assert.equal(retry.requestHash,first.requestHash);
  await assert.rejects(reserve.reserve({...a,taskId:'taskid1234567899'}),
    /AO task reservation denied/);

  const other=await reserve.reserve(b);
  assert.equal(other.replayed,false);
  assert.notEqual(other.requestHash,first.requestHash);
  const fresh=make(tenantA,'principal-a','parallelrequest001');
  const parallel=await Promise.all([reserve.reserve(fresh),reserve.reserve(fresh)]);
  assert.deepEqual(parallel.map(r=>r.replayed).sort(),[false,true]);
  assert.ok(parallel.every(r=>r.grantIssued===false&&r.executionSupported===false));
  const stored=await admin`SELECT tenant_id::text AS tenant, state,
    count(*)::int AS count FROM public.ao_task_reservations
    WHERE request_hash=${parallel[0].requestHash}
    GROUP BY tenant_id,state`;
  assert.equal(stored.length,1);assert.equal(stored[0].count,1);
  assert.equal(stored[0].tenant,tenantA);
  assert.equal(stored[0].state,'pending_review');

  await assert.rejects(reserve.reserve(make(tenantA,'disabled-a','disablednonce00001')),
    /AO task reservation denied/);
  await assert.rejects(reserve.reserve({...a,principalId:'principal-b'}),
    /AO task reservation denied/);
  await assert.rejects(reserve.reserve({...a,toolId:'ao.exec',principalId:'privileged-a',
    requestId:'privilegednonce001'}),/AO task reservation denied/);
  await admin`UPDATE public.ao_ci_actor_rights SET entitled=FALSE
    WHERE tenant_id=${tenantA} AND principal_id='principal-a'`;
  await assert.rejects(reserve.reserve(a),/AO task reservation denied/);
  await assert.rejects(reserve.reserve(make(tenantA,'principal-a','postrevoke0000001')),
    /AO task reservation denied/);
  const bRetry=await reserve.reserve(b);
  assert.equal(bRetry.replayed,true);
  const count=await admin`SELECT count(*)::int AS n FROM public.ao_task_reservations
    WHERE request_hash=${first.requestHash} AND tenant_id=${tenantA}`;
  assert.equal(count[0].n,1);
 }finally{
  await app.end({timeout:5});
  await admin.end({timeout:5});
 }
});
