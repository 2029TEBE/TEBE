import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolvePostgresDeployment } from './postgres-deployment-adapter.mjs';
const T='11111111-1111-4111-8111-111111111111';
const U='22222222-2222-4222-8222-222222222222';
const D='33333333-3333-4333-8333-333333333333';
const session={authenticated:true,userId:U,tenantId:T};
const approvedOrigins=['https://api-staging.theepmo.com'];
const rows=[
 {user_id:U,tenant_id:T,active:true},
 {tenant_id:T,deployment_id:D,immutable:true},
 {id:D,tenant_id:T,profile:'shared_sa',region:'me-central2',status:'active',api_origin:approvedOrigins[0]}
];
const rlsOk={restricted:true,protected_count:'3',table_count:'3'};
const fixture=(overrides={})=>{
 const calls=[];
 const db={query:async(sql,args)=>{
   calls.push({sql,args});
   const index=calls.length-1;
   return {rows:[(Object.hasOwn(overrides,index) ? overrides[index] : (index===0 ? rlsOk : rows[index-1]))]};
 }};
 return {db,calls};
};
test('authenticated tenant-scoped SQL lookup returns trusted deployment',async()=>{
 const {db,calls}=fixture();
 const value=await resolvePostgresDeployment({db,session,approvedOrigins});
 assert.equal(value.deploymentId,D);
 assert(Object.isFrozen(value));
 assert.deepEqual(calls.map(c=>c.args),[undefined,[U,T],[T],[D,T]]);
 assert(calls.every(c=>!c.sql.includes(U)&&!c.sql.includes(T)));
});
for(const [name,overrides] of [
 ['cross tenant membership',{1:{...rows[0],tenant_id:U}}],
 ['inactive membership',{1:{...rows[0],active:false}}],
 ['mutable binding',{2:{...rows[1],immutable:false}}],
 ['cross tenant registry',{3:{...rows[2],tenant_id:U}}],
 ['unapproved region',{3:{...rows[2],region:'us-east-1'}}],
 ['spoofed deployment',{2:{...rows[1],deployment_id:U}}],
 ['untrusted origin',{3:{...rows[2],api_origin:'https://evil.example'}}]
]) test('denies '+name,async()=>{
 const {db}=fixture(overrides);
 await assert.rejects(resolvePostgresDeployment({db,session,approvedOrigins}),e=>e.message==='Deployment unavailable');
});
test('rejects unauthenticated principal before database access',async()=>{
 const {db,calls}=fixture();
 await assert.rejects(resolvePostgresDeployment({db,session:{...session,authenticated:false},approvedOrigins}));
 assert.equal(calls.length,0);
});
test('redacts database errors',async()=>{
 const db={query:async()=>{throw Error('postgres://private:secret@db.internal');}};
 await assert.rejects(resolvePostgresDeployment({db,session,approvedOrigins}),e=>e.message==='Deployment unavailable'&&!e.message.includes('secret'));
});
test('rejects duplicate membership rows',async()=>{
 const db={query:async(sql)=>({rows:sql.includes('pg_roles')?[rlsOk]:[rows[0],rows[0]]})};
 await assert.rejects(resolvePostgresDeployment({db,session,approvedOrigins}));
});

for (const [label, guard] of [
  ['superuser role', {...rlsOk,restricted:false}],
  ['missing forced RLS', {...rlsOk,protected_count:'2'}],
  ['missing routing table', {...rlsOk,table_count:'2'}],
  ['missing role attestation', null],
]) test('fails closed for '+label, async () => {
  const {db,calls}=fixture({0:guard});
  await assert.rejects(resolvePostgresDeployment({db,session,approvedOrigins}),
    error=>error.message==='Deployment unavailable');
  assert.equal(calls.length,1);
});

// Regression: the RLS preflight attests public.* tables; subsequent reads
// must not be redirected through a caller-controlled PostgreSQL search_path.
test('tenant reads use the same schema-qualified relations attested by RLS', async () => {
  const {db,calls}=fixture();
  await resolvePostgresDeployment({db,session,approvedOrigins});
  assert.match(calls[1].sql, /FROM public\.tenant_memberships\b/);
  assert.match(calls[2].sql, /FROM public\.tenant_deployment_bindings\b/);
  assert.match(calls[3].sql, /FROM public\.tenant_deployments\b/);
});
