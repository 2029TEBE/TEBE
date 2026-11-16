import test from 'node:test';
import assert from 'node:assert/strict';
import {createGaizReportWorker} from './gaiz-report-worker.mjs';
import {renderGaizExecutiveBrief,GAIZ_EXECUTIVE_BRIEF_WORKER_KEY}
 from './gaiz-executive-brief.mjs';
const job={id:'job-1',orderId:'order-1',customerId:'customer-1',
 toolId:'gaiz.executive-brief.v1',workerKey:GAIZ_EXECUTIVE_BRIEF_WORKER_KEY,
 leaseToken:'a'.repeat(43),format:'html',deadlineEpoch:1794833600,
 inputs:{title:'Strategy & Governance',findings:['Projects <b>must be reviewed</b>'],
 recommendations:['Track portfolio outcomes']}};
const entitlement={
 verifiedByServer:true,paidOrder:true,entitled:true,orderId:job.orderId,
 customerId:job.customerId,jobId:job.id,toolId:job.toolId,orderState:'processing'
};
function setup({claim=job,proof=entitlement,commit=true,handler=renderGaizExecutiveBrief}={}){
 const actions=[],queue={
  async claimNext(){actions.push('claim');return claim},
  async confirmEntitlement(){actions.push('verify');return proof},
  async completeWithArtifact(payload){actions.push('commit');return {committed:commit}},
  async failClaim(){actions.push('fail')}
 };
 const artifactStore={async stagePrivate(p){
  actions.push('stage');return {stageId:'stage-1',sha256:p.sha256,
   customerId:p.customerId,jobId:p.jobId}
 }};
 return {actions,worker:createGaizReportWorker({enabled:true,queue,artifactStore,
  handlers:{[GAIZ_EXECUTIVE_BRIEF_WORKER_KEY]:handler},
  clock:()=>1794830000})};
}
test('worker is disabled unless injected atomic job queue is available',()=>{
 assert.throws(()=>createGaizReportWorker());
 assert.throws(()=>createGaizReportWorker({enabled:true,handlers:{}}));
});
test('successful paid job generates private artifact only after entitlement',async()=>{
 const f=setup();
 const result=await f.worker.runOnce();
 assert.equal(result.status,'completed');
 assert.deepEqual(f.actions,['claim','verify','stage','commit']);
});
test('empty worker queue is safe',async()=>{
 const f=setup({claim:null});
 assert.deepEqual(await f.worker.runOnce(),{status:'empty'});
 assert.deepEqual(f.actions,['claim']);
});
test('unpaid job cannot run handler or stage artifact',async()=>{
 const f=setup({proof:{...entitlement,paidOrder:false}});
 const result=await f.worker.runOnce();
 assert.equal(result.status,'failed');
 assert.deepEqual(f.actions,['claim','verify','fail']);
});
test('unsupported server worker key fails without invoking dynamic tool code',async()=>{
 const f=setup({claim:{...job,workerKey:'arbitrary.binary.exec'}});
 assert.equal((await f.worker.runOnce()).status,'failed');
 assert.equal(f.actions.includes('stage'),false);
});
test('invalid lease and expired job never run',async()=>{
 for(const change of [{leaseToken:'short'},{deadlineEpoch:1794829999}]){
  const f=setup({claim:{...job,...change}});
  if(change.leaseToken)await assert.rejects(f.worker.runOnce());
  else assert.equal((await f.worker.runOnce()).status,'failed');
  assert.equal(f.actions.includes('stage'),false);
 }
});
test('unconfirmed commit fails closed with no public success',async()=>{
 const f=setup({commit:false});
 assert.equal((await f.worker.runOnce()).status,'failed');
 assert.equal(f.actions.includes('fail'),true);
});
test('HTML executive brief escapes malicious markup and blocks unsupported payloads',()=>{
 const result=renderGaizExecutiveBrief({inputs:job.inputs,toolId:job.toolId,format:'html'});
 const text=result.bytes.toString('utf8');
 assert.equal(text.includes('<b>must be reviewed</b>'),false);
 assert.ok(text.includes('&lt;b&gt;must be reviewed&lt;/b&gt;'));
 assert.ok(text.includes('Content-Security-Policy'));
 assert.throws(()=>renderGaizExecutiveBrief({inputs:{...job.inputs,script:'alert(1)'},toolId:job.toolId,format:'html'}));
 assert.throws(()=>renderGaizExecutiveBrief({inputs:job.inputs,toolId:job.toolId,format:'pdf'}));
});
