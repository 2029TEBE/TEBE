import test from 'node:test';
import assert from 'node:assert/strict';
import {createAoReviewReservation} from './ao-review-reservation.mjs';
const tenantId='11111111-1111-4111-8111-111111111111', otherTenant='22222222-2222-4222-8222-222222222222';
const task={version:'1.0.0',tenantId,principalId:'user-a',toolId:'ao.read',
 requestId:'request000000000001',taskId:'task00000000000001',intent:{}};
const trust=(c,t)=>({verified:true,tenantId:t.tenantId,principalId:t.principalId,toolId:t.toolId,
 risk:'read',transport:'tebe_api',executionSupported:false});
function mock({existing=null,badCommit=false,badInsert=false}={}){
 const calls=[], released=[];
 const client={async query(sql,values=[]){
  calls.push({sql,values});
  if(sql==='COMMIT'&&badCommit)throw Error('unavailable');
  if(sql.startsWith('INSERT INTO ao_task_reservations')){
   if(existing)return {rows:[]};
   return {rows:badInsert?[]:[{requestDigest:values[2],state:'pending_review'}]};
  }
  if(sql.startsWith('SELECT request_digest AS')){
   const initial=calls.find(c=>c.sql.startsWith('INSERT INTO ao_task_reservations'));
   return {rows:existing==='match'?[{requestDigest:initial.values[2],
     principalId:initial.values[3],toolId:initial.values[4],
     taskId:initial.values[5],state:'pending_review'}]:existing?[existing]:[]};
  }
  return {rows:[]};
 },release(){released.push(true)}};
 return {pool:{async connect(){return client}},calls,released};
}
const build=(m,verify=trust)=>createAoReviewReservation({
 enabled:true,pool:m.pool,verifyTrustedReadInTransaction:verify});
test('disabled by default without an approved transaction verifier',()=>{
 assert.throws(()=>createAoReviewReservation());
 assert.throws(()=>createAoReviewReservation({enabled:true,pool:mock().pool}));
});
test('first read-only request atomically reserves for review but never execution',async()=>{
 const m=mock();const out=await build(m).reserve(task);
 assert.equal(out.status,'PENDING_REVIEW');assert.equal(out.replayed,false);
 assert.equal(out.executionSupported,false);assert.equal(out.grantIssued,false);
 assert.deepEqual(m.calls.map(x=>x.sql==='BEGIN'||x.sql==='COMMIT'?x.sql:
  x.sql.startsWith('SELECT set_config')?'tenant':x.sql.startsWith('INSERT INTO')?'insert':'other'),
 ['BEGIN','tenant','insert','COMMIT']);
 assert.equal(m.calls[1].values[0],tenantId);
 assert.equal(m.calls[2].values[0],tenantId);
 assert.equal(m.calls[2].values[1].length,64);
 assert.equal(m.calls[2].values.includes(task.requestId),false);
 assert.equal(m.released.length,1);
});
test('identical retry is idempotent with no second admission',async()=>{
 const m=mock({existing:'match'});const out=await build(m).reserve(task);
 assert.equal(out.replayed,true);assert.equal(out.executionSupported,false);
 assert.ok(m.calls.some(x=>x.sql.includes('FOR UPDATE')));
 assert.equal(m.calls.filter(x=>x.sql==='COMMIT').length,1);
});
test('nonce reuse for altered request or different tenant is rejected',async()=>{
 for(const change of [{principalId:'user-b'},{toolId:'ao.other'},{taskId:'task00000000000002'}, {state:'completed'}]){
  const prior={requestDigest:'0'.repeat(64),principalId:change.principalId||'user-a',
   toolId:change.toolId||'ao.read',taskId:change.taskId||task.taskId,state:change.state||'pending_review'};
  const m=mock({existing:prior});
  await assert.rejects(build(m).reserve(task),/denied/);
  assert.ok(m.calls.some(x=>x.sql==='ROLLBACK'));assert.equal(m.released.length,1);
 }
 const m=mock();await assert.rejects(build(m,()=>trust(null,{...task,tenantId:otherTenant})).reserve(task),/denied/);
});
test('untrusted server state or non-read-only risk is denied and rolled back',async()=>{
 for(const change of [{verified:false},{executionSupported:true},{risk:'external_write'},
  {transport:'mcp_http'},{principalId:'other'},{tenantId:otherTenant}]){
  const m=mock();
  await assert.rejects(build(m,(c,t)=>({...trust(c,t),...change})).reserve(task),/denied/);
  assert.ok(m.calls.some(x=>x.sql==='ROLLBACK'));
 }
});
test('unmodeled command/approval/artifact payload and bad identifiers fail before DB calls',async()=>{
 for(const change of [{intent:{command:'shell'}},{approvalId:'approval123'},
  {artifactRefs:['secret']},{tenantId:'evil'},{requestId:'short'}, {toolId:'shell;rm'},
  {principalId:'user a'}, {extra:'value'}]){
  const m=mock();await assert.rejects(build(m).reserve({...task,...change}),/denied/);
  assert.equal(m.calls.length,0);
 }
});
test('database error, empty insert and commit failure never return an admission',async()=>{
 for(const opts of [{badCommit:true},{badInsert:true}]){
  const m=mock(opts);await assert.rejects(build(m).reserve(task),/denied/);
  assert.ok(m.calls.some(x=>x.sql==='ROLLBACK'));assert.equal(m.released.length,1);
 }
});

test('pool acquisition errors are redacted and malformed checked-out clients are released',async()=>{
 const raw=Error('postgres://sensitive-user:secret@internal-db');
 const failing=createAoReviewReservation({enabled:true,
  pool:{async connect(){throw raw}},verifyTrustedReadInTransaction:trust});
 await assert.rejects(failing.reserve(task),e=>{
  assert.equal(e.message,'AO task reservation denied');
  assert.equal(e.message.includes('secret'),false);
  return true;
 });
 let released=0;
 const malformed=createAoReviewReservation({enabled:true,
  pool:{async connect(){return {release(){released++}}}},verifyTrustedReadInTransaction:trust});
 await assert.rejects(malformed.reserve(task),/AO task reservation denied/);
 assert.equal(released,1);
});

test('connection release errors never leak database credentials or report successful reservation',async()=>{
 const m=mock();
 const failing={...m.pool,async connect(){
  const client=await m.pool.connect();
  return {...client,release(){throw Error('postgres://internal-user:secret@db.internal')}};
 }};
 const reserve=createAoReviewReservation({enabled:true,pool:failing,verifyTrustedReadInTransaction:trust});
 await assert.rejects(reserve.reserve(task),e=>{
  assert.equal(e.message,'AO task reservation denied');
  assert.equal(e.message.includes('secret'),false);
  return true;
 });
 assert.equal(m.calls.filter(c=>c.sql==='COMMIT').length,1);
});
