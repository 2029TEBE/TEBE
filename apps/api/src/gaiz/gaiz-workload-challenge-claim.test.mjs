import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {claimGaizWorkloadChallengeInTransaction} from './gaiz-workload-challenge-claim.mjs';

const tenantId='11111111-1111-4111-8111-111111111111';
const workerId='33333333-3333-4333-8333-333333333333';
const workItemId='22222222-2222-4222-8222-222222222222';
const challenge=randomBytes(32).toString('base64url');
const digest=createHash('sha256').update(Buffer.from(challenge,'base64url')).digest('hex');
const args=()=>({
 challenge,tenantId,workerId,workItemId,purpose:'gaiz_verify_worker',
 credentialIssuer:'test-trusted-credential-issuer',
 nowMs:1800000000050,credentialExpiresAtMs:1800000030000,
});
const withDev=async fn=>{
 const prev=process.env.GAIZ_DEV_ONLY,node=process.env.NODE_ENV;
 try{process.env.GAIZ_DEV_ONLY='true';process.env.NODE_ENV='test';return await fn();}
 finally{
  if(prev===undefined)delete process.env.GAIZ_DEV_ONLY;else process.env.GAIZ_DEV_ONLY=prev;
  if(node===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=node;
 }
};
const fakeTx=(opts={})=>{
 let queries=0,consumed=false;
 return {
  get queries(){return queries;},
  execute:async()=>{
   queries++;
   if(queries===1)return [{dbRole:opts.role??'gaiz_verify_worker',currentTenant:opts.tenant??tenantId}];
   if(opts.replay||consumed)return [];
   consumed=true;
   return [{challengeSha256:digest}];
  },
 };
};
test('synthetic preissued challenge claim returns inert digest receipt',()=>withDev(async()=>{
 const tx=fakeTx();
 const receipt=await claimGaizWorkloadChallengeInTransaction(tx,args());
 assert.equal(receipt.claimAcquired,true);
 assert.equal(receipt.challengeSha256,digest);
 assert.equal(receipt.assignmentClaimStillRequired,true);
 assert.equal(receipt.independentTransportAuthenticationRequired,true);
 assert.equal(receipt.importAllowed,false);
 assert.equal(Object.hasOwn(receipt,'challenge'),false);
 assert.equal(Object.isFrozen(receipt),true);
 assert.equal(tx.queries,2);
}));
test('wrong DB role or tenant is rejected before mutation',()=>withDev(async()=>{
 for(const options of [{role:'pmo_app'},{role:'gaiz_execute_worker'},{tenant:workItemId}]){
  const tx=fakeTx(options);
  await assert.rejects(claimGaizWorkloadChallengeInTransaction(tx,args()));
  assert.equal(tx.queries,1);
 }
}));
test('already consumed challenge and wrong persisted digest fail closed',()=>withDev(async()=>{
 await assert.rejects(claimGaizWorkloadChallengeInTransaction(fakeTx({replay:true}),args()));
 const tx={execute:async()=>[{dbRole:'gaiz_verify_worker',currentTenant:tenantId}]};
 await assert.rejects(claimGaizWorkloadChallengeInTransaction(tx,args()));
}));
test('invalid challenge and expired credential refuse SQL access',()=>withDev(async()=>{
 for(const change of [
  {challenge:'not-base64!'},{challenge:'AA'},{tenantId:workItemId+'x'},
  {workerId:'invalid'},{purpose:'gaiz_execute_worker',credentialIssuer:''},
  {credentialExpiresAtMs:1800000000050}, {nowMs:-1},
 ]){
  let calls=0;
  await assert.rejects(claimGaizWorkloadChallengeInTransaction({
   execute:async()=>{calls++;return []},
  },{...args(),...change}));
  assert.equal(calls,0);
 }
}));
test('production stays disabled and SQL declares database-enforced replay lock',async()=>{
 const prev=process.env.NODE_ENV,flag=process.env.GAIZ_DEV_ONLY;
 try{
  process.env.NODE_ENV='production';process.env.GAIZ_DEV_ONLY='true';
  await assert.rejects(claimGaizWorkloadChallengeInTransaction(fakeTx(),args()));
 }finally{
  if(prev===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=prev;
  if(flag===undefined)delete process.env.GAIZ_DEV_ONLY;else process.env.GAIZ_DEV_ONLY=flag;
 }
 const sql=readFileSync(new URL('../../../../packages/db/sql/gaiz-workload-challenge-review-proposal.sql',import.meta.url),'utf8');
 const helper=readFileSync(new URL('./gaiz-workload-challenge-claim.mjs',import.meta.url),'utf8');
 assert.match(sql,/PRIMARY KEY/);
 assert.match(sql,/FORCE ROW LEVEL SECURITY/);
 assert.match(sql,/TO gaiz_verify_worker,gaiz_execute_worker/);
 assert.match(sql,/REVOKE ALL ON gaiz_workload_challenges FROM pmo_app/);
 assert.match(helper,/consumed_at IS NULL/);
 assert.match(helper,/current_user/);
 assert.match(helper,/expires_at > clock_timestamp\(\)/);
});
