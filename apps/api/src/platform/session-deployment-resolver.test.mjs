import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveDeploymentForSession } from './session-deployment-resolver.mjs';
import { DeploymentRoutingError } from './trusted-deployment-routing.mjs';
const A='11111111-1111-4111-8111-111111111111';
const U='22222222-2222-4222-8222-222222222222';
const D='33333333-3333-4333-8333-333333333333';
const fixture=()=>({
  session:{authenticated:true,userId:U,tenantId:A},
  loadMembership:async(userId,tenantId)=>({userId,tenantId,active:true}),
  loadBinding:async tenantId=>({tenantId,deploymentId:D,immutable:true}),
  loadRegistry:async id=>({id,tenantId:A,profile:'shared_sa',region:'me-central2',status:'active',apiOrigin:'https://api-staging.theepmo.com'}),
  approvedOrigins:['https://api-staging.theepmo.com']
});
test('loads deployment only through authenticated session and trusted adapters',async()=>{
  const x=fixture(); const calls=[];
  const original=x.loadBinding;
  x.loadBinding=async id=>{calls.push(id);return original(id);};
  const target=await resolveDeploymentForSession(x);
  assert.deepEqual(calls,[A]);assert.equal(target.deploymentId,D);assert(Object.isFrozen(target));
});
for(const [name,change] of [
 ['unauthenticated',x=>x.session.authenticated=false],
 ['membership mismatch',x=>x.loadMembership=async()=>({userId:U,tenantId:D,active:true})],
 ['inactive membership',x=>x.loadMembership=async()=>({userId:U,tenantId:A,active:false})],
 ['missing binding',x=>x.loadBinding=async()=>null],
 ['mutable binding',x=>x.loadBinding=async()=>({tenantId:A,deploymentId:D,immutable:false})],
 ['cross tenant registry',x=>x.loadRegistry=async id=>({id,tenantId:U,profile:'shared_sa',region:'me-central2',status:'active',apiOrigin:'https://api-staging.theepmo.com'})],
 ['database exception',x=>x.loadRegistry=async()=>{throw Error('secret database URL');}],
 ['untrusted origin',x=>x.approvedOrigins=[]],
 ['missing loader',x=>x.loadMembership=null]
]) test('fails closed: '+name,async()=>{
 const x=fixture();change(x);
 await assert.rejects(resolveDeploymentForSession(x),e=>e instanceof DeploymentRoutingError && e.message==='Deployment unavailable');
});
