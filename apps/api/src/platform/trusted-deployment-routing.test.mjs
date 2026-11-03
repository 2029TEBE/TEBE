import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveTrustedDeployment, DeploymentRoutingError } from './trusted-deployment-routing.mjs';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222', D='33333333-3333-4333-8333-333333333333';
const good=()=>({principal:{authenticated:true,userId:B,tenantId:A,membershipActive:true},binding:{tenantId:A,deploymentId:D,immutable:true},registry:{id:D,tenantId:A,profile:'shared_sa',region:'me-central2',status:'active',apiOrigin:'https://api-staging.theepmo.com'},approvedOrigins:['https://api-staging.theepmo.com']});
test('trusted routing returns frozen server-owned target',()=>{const result=resolveTrustedDeployment(good());assert.equal(result.deploymentId,D);assert(Object.isFrozen(result));});
for (const [name,mutate] of [
 ['unauthenticated',x=>x.principal.authenticated=false],
 ['inactive membership',x=>x.principal.membershipActive=false],
 ['cross tenant principal',x=>x.principal.tenantId=B],
 ['mutable binding',x=>x.binding.immutable=false],
 ['wrong deployment',x=>x.registry.id=B],
 ['cross deployment registry',x=>x.registry.tenantId=B],
 ['inactive deployment',x=>x.registry.status='disabled'],
 ['unapproved region',x=>x.registry.region='us-east-1'],
 ['unapproved profile',x=>x.registry.profile='dedicated_us'],
 ['client selected origin',x=>x.registry.apiOrigin='https://evil.example'],
 ['origin credentials',x=>{x.registry.apiOrigin='https://user:password@api-staging.theepmo.com';x.approvedOrigins=[x.registry.apiOrigin]}],
 ['origin path',x=>{x.registry.apiOrigin='https://api-staging.theepmo.com/other';x.approvedOrigins=[x.registry.apiOrigin]}]
]) test('rejects '+name,()=>{const x=good();mutate(x);assert.throws(()=>resolveTrustedDeployment(x),DeploymentRoutingError);});
