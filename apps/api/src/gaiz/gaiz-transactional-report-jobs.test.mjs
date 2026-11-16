import test from 'node:test';
import assert from 'node:assert/strict';
import {createGaizTransactionalReportJobs} from './gaiz-transactional-report-jobs.mjs';
const customerId='123e4567-e89b-42d3-a456-426614174000';
const orderId='223e4567-e89b-42d3-a456-426614174000';
const jobId='323e4567-e89b-42d3-a456-426614174000';
const entitlementId='423e4567-e89b-42d3-a456-426614174000';
const NOW=1794830000;
const args={customerId,orderId,idempotencyKey:'request-key-12345678',
 toolId:'gaiz.executive-brief.v1',productId:'executive-brief',
 workerKey:'gaiz.executive-brief.v1',format:'html',
 priceMinor:1000,currency:'USD',inputs:{title:'Board Report',findings:['Review']}}; 
const row=x=>({rows:x?[x]:[]});
function db({
 account='active',state='paid',grant='verified_payment',
 entitlement=true,policy=true,insert=true,update=true
}={}){
 const queries=[],jobs=new Map();let orderState=state,revision=3,released=0;
 const query=async(sql,params=[])=>{
  queries.push({sql,params});
  if(sql==='BEGIN'||sql==='ROLLBACK'||sql==='COMMIT')return row(null);
  if(sql.includes('FROM orgaiz_orders o JOIN orgaiz_customers'))return row({
   id:orderId,customerId,toolId:args.toolId,amountMinor:'1000',
   currency:'USD',state:orderState,revision,customerStatus:account
  });
  if(sql.includes('idempotency_digest=$3'))return row(jobs.get(params[2])||null);
  if(sql.includes('SELECT id FROM orgaiz_jobs WHERE order_id'))return row(
   jobs.size?{id:jobId}:null);
  if(sql.includes('FROM orgaiz_order_entitlements'))return row(
   entitlement?{id:entitlementId,grantedBy:grant}:null);
  if(sql.includes('INSERT INTO orgaiz_jobs')){
   if(!insert)return row(null);
   jobs.set(params[8],{id:jobId,orderId,customerId,requestDigest:params[7],state:'queued'});
   return row({id:jobId,orderId,customerId,state:'queued'});
  }
  if(sql.includes('UPDATE orgaiz_orders SET state=')){
   if(!update)return row(null);
   orderState='queued';revision++;return row({id:orderId});
  }
  if(sql.includes('FROM orgaiz_jobs j')&&sql.includes('JOIN orgaiz_customers')){
   return row({id:jobId,orderId,customerId,state:'queued'});
  }
  return row(null);
 };
 const store={async connect(){return {query,release(){released++}}}};
 const toolPolicy={async verifyForOrderInTransaction(client,request){
  assert.ok(client);
  assert.equal(request.orderId,orderId);
  return {allowed:policy,active:true,quotaAvailable:true};
 }};
 const service=createGaizTransactionalReportJobs({
  enabled:true,pool:store,toolPolicy,clock:()=>NOW
 });
 return {service,queries,jobs,released:()=>released};
}
test('fail-closed without dedicated DB and trusted tool policy',()=>{
 assert.throws(()=>createGaizTransactionalReportJobs());
 assert.throws(()=>createGaizTransactionalReportJobs({
  enabled:true,pool:{connect:async()=>{}}
 }));
});
test('valid paid owned order produces one job, queues order and audits before commit',async()=>{
 const d=db();
 const result=await d.service.submitFromEntitlement(args);
 assert.equal(result.jobId,jobId);
 assert.equal(result.replayed,false);
 assert.equal(result.state,'queued');
 assert.equal(d.queries[0].sql,'BEGIN');
 assert.equal(d.queries.at(-1).sql,'COMMIT');
 assert.ok(d.queries.some(q=>q.sql.includes('FOR UPDATE OF o,cu')));
 assert.ok(d.queries.some(q=>q.sql.includes('INSERT INTO orgaiz_job_audit')));
 assert.equal(d.released(),1);
});
test('identical submission replays same job and cannot create another',async()=>{
 const d=db();
 const first=await d.service.submitFromEntitlement(args);
 const second=await d.service.submitFromEntitlement(args);
 assert.equal(first.jobId,second.jobId);
 assert.equal(second.replayed,true);
 assert.equal(d.queries.filter(q=>q.sql.includes('INSERT INTO orgaiz_jobs')).length,1);
});
test('same idempotency key with changed request rejects under lock',async()=>{
 const d=db();
 await d.service.submitFromEntitlement(args);
 await assert.rejects(d.service.submitFromEntitlement({
  ...args,inputs:{title:'Different Report',findings:['Review']}
 }));
 assert.equal(d.queries.at(-1).sql,'ROLLBACK');
 assert.equal(d.queries.filter(q=>q.sql.includes('INSERT INTO orgaiz_jobs')).length,1);
});
test('unpaid and suspended accounts never obtain jobs',async()=>{
 for(const opts of [{state:'created'},{account:'suspended'},{entitlement:false},
  {grant:'manual_override'},{policy:false}]){
  const d=db(opts);
  await assert.rejects(d.service.submitFromEntitlement(args));
  assert.equal(d.queries.some(q=>q.sql.includes('INSERT INTO orgaiz_jobs')),false);
  assert.equal(d.queries.at(-1).sql,'ROLLBACK');
  assert.equal(d.released(),1);
 }
});
test('wrong customer and price are denied before entitlement lookup',async()=>{
 for(const changes of [{customerId:'523e4567-e89b-42d3-a456-426614174000'},
  {priceMinor:1},{toolId:'malicious-tool'}]){
  const d=db();
  await assert.rejects(d.service.submitFromEntitlement({...args,...changes}));
  assert.equal(d.queries.some(q=>q.sql.includes('INSERT INTO orgaiz_jobs')),false);
 }
});
test('failed job insertion and failed revision CAS rollback transaction',async()=>{
 for(const opts of [{insert:false},{update:false}]){
  const d=db(opts);
  await assert.rejects(d.service.submitFromEntitlement(args));
  assert.equal(d.queries.at(-1).sql,'ROLLBACK');
  assert.equal(d.queries.some(q=>q.sql.includes('INSERT INTO orgaiz_job_audit')),false);
 }
});
test('job lookups are always customer-scoped',async()=>{
 const d=db();
 const actual=await d.service.getOwnedJob(jobId,customerId);
 assert.equal(actual.id,jobId);
 assert.equal(d.queries.at(-2).params[1],customerId);
 await assert.rejects(d.service.getOwnedJob(jobId,'other'));
});
