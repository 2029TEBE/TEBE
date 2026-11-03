import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createDeploymentEndpoint } from './deployment-http-endpoint.mjs';
const T='11111111-1111-4111-8111-111111111111';
const U='22222222-2222-4222-8222-222222222222';
const D='33333333-3333-4333-8333-333333333333';
const origin='https://api-staging.theepmo.com';
const rows=[
  {user_id:U,tenant_id:T,active:true},
  {tenant_id:T,deployment_id:D,immutable:true},
  {id:D,tenant_id:T,profile:'shared_sa',region:'me-central2',status:'active',api_origin:origin}
];
async function invoke({authenticate=async()=>({authenticated:true,userId:U,tenantId:T}),db={query:async()=>({rows:[rows.shift()]})},request={headers:{'x-tenant-id':'attacker','x-deployment-id':'attacker'}}}={}) {
  const response={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.body=JSON.parse(s);}};
  await createDeploymentEndpoint({db,approvedOrigins:[origin],authenticate})(request,response);
  return response;
}
test('anonymous caller denied without querying database',async()=>{
  let queries=0;
  const result=await invoke({authenticate:async()=>null,db:{query:async()=>{queries++;return {rows:[]};}}});
  assert.equal(result.statusCode,401);
  assert.equal(queries,0);
  assert.equal(result.headers['Cache-Control'],'no-store');
});
test('server principal overrides spoofed tenant/deployment headers',async()=>{
  // E73 must attest the restricted role and forced RLS BEFORE tenant reads.
  // A fixture without this row only tests fail-closed 403, not spoofing resistance.
  const replies=[{restricted:true,protected_count:'3',table_count:'3'},...rows];
  const seen=[];
  const result=await invoke({db:{query:async(_sql,args)=>{
    seen.push(args);
    return {rows:[replies.shift()]};
  }}});
  assert.equal(result.statusCode,200);
  assert.equal(result.body.deploymentId,D);
  assert.deepEqual(seen,[undefined,[U,T],[T],[D,T]]);
  assert.equal(JSON.stringify(result.body).includes('attacker'),false);
});
test('database failures redact connection secrets',async()=>{
  const result=await invoke({db:{query:async()=>{throw Error('postgres://password@internal');}}});
  assert.equal(result.statusCode,403);
  assert.equal(JSON.stringify(result.body).includes('password'),false);
});
test('cross-tenant registry denied only after valid RLS attestation and scoped reads',async()=>{
  let n=0;
  const bad=[{restricted:true,protected_count:'3',table_count:'3'},
    rows[0],rows[1],{...rows[2],tenant_id:U}];
  const result=await invoke({db:{query:async()=>({rows:[bad[n++]]})}});
  assert.equal(result.statusCode,403);
  // This assertion prevents a false positive caused by an invalid preflight fixture.
  assert.equal(n,4);
});
