import test from 'node:test';
import assert from 'node:assert/strict';
import {createGaizPostgresWorkerQueue} from './gaiz-postgres-worker-queue.mjs';
import {createGaizPrivateArtifactStore} from './gaiz-private-artifact-store.mjs';
import {createHash} from 'node:crypto';
const jobId='123e4567-e89b-42d3-a456-426614174000';
const orderId='223e4567-e89b-42d3-a456-426614174000';
const customerId='323e4567-e89b-42d3-a456-426614174000';
const stageId='423e4567-e89b-42d3-a456-426614174000';
const artifactId='523e4567-e89b-42d3-a456-426614174000';
const now=1794830000;
function stubDb(resolve){
 const calls=[];let released=0;
 const query=async(sql,parameters=[])=>{calls.push({sql,parameters});return resolve(sql,parameters)};
 return {calls,pool:{async connect(){return {query,release(){released++}}}},released:()=>released};
}
const rows=(x)=>({rows:x?[x]:[]});
test('queue requires DB connection and remains disabled',()=>{
 assert.throws(()=>createGaizPostgresWorkerQueue());
 assert.throws(()=>createGaizPostgresWorkerQueue({enabled:true,pool:{}}));
});
test('empty queue commits and releases pooled connection without issuing a lease',async()=>{
 const db=stubDb(sql=>sql.includes('SELECT j.id')?rows(null):rows(null));
 const queue=createGaizPostgresWorkerQueue({enabled:true,pool:db.pool,clock:()=>now});
 assert.equal(await queue.claimNext(),null);
 assert.equal(db.calls[0].sql,'BEGIN');
 assert.equal(db.calls[db.calls.length-1].sql,'COMMIT');
 assert.equal(db.released(),1);
 assert.ok(db.calls.some(c=>c.sql.includes('SKIP LOCKED')));
});
test('job claim creates fresh leased claim and atomically moves order to processing',async()=>{
 const db=stubDb(sql=>{
  if(sql.includes('SELECT j.id'))return rows({
   id:jobId,orderId,customerId,toolId:'gaiz.executive-brief.v1',
   workerKey:'gaiz.executive-brief.v1',format:'html',inputs:{title:'Demo'},
   attempts:0,deadlineAt:new Date((now+600)*1000),
   orderState:'queued',revision:2
  });
  if(sql.includes('RETURNING id'))return rows({id:jobId});
  return rows(null);
 });
 const q=createGaizPostgresWorkerQueue({enabled:true,pool:db.pool,clock:()=>now});
 const claim=await q.claimNext();
 assert.equal(claim.id,jobId);
 assert.equal(claim.leaseToken.length,43);
 assert.ok(db.calls.some(c=>c.sql.includes("state='processing'")));
 assert.equal(db.calls[db.calls.length-1].sql,'COMMIT');
});
test('DB failures always ROLLBACK and release',async()=>{
 const db=stubDb(sql=>{
  if(sql.includes('SELECT j.id'))throw Error('synthetic database outage');
  return rows(null);
 });
 const q=createGaizPostgresWorkerQueue({enabled:true,pool:db.pool,clock:()=>now});
 await assert.rejects(q.claimNext());
 assert.equal(db.calls[db.calls.length-1].sql,'ROLLBACK');
 assert.equal(db.released(),1);
});
test('artifact adapter refuses missing encryption service and mismatched digest',async()=>{
 assert.throws(()=>createGaizPrivateArtifactStore());
 const db=stubDb(()=>rows(null));
 const store=createGaizPrivateArtifactStore({enabled:true,pool:db.pool,
  objectStore:{putEncrypted:async()=>({}),getPrivate:async()=>({})}});
 await assert.rejects(store.stagePrivate({
  jobId,customerId,format:'html',bytes:Buffer.from('hello'),
  sha256:'0'.repeat(64),sizeBytes:5,contentType:'text/html; charset=utf-8'
 }));
});
test('private stage upload persists only encrypted storage-key pointer',async()=>{
 let objectKey;
 const db=stubDb(sql=>sql.includes('INSERT INTO orgaiz_artifact_staging')?
  rows({id:stageId,jobId,customerId,sha256:createHash('sha256').update('Hello').digest('hex')}):rows(null));
 const store=createGaizPrivateArtifactStore({enabled:true,pool:db.pool,
  objectStore:{async putEncrypted(a){objectKey=a.objectKey;
    assert.equal(a.public,false);assert.equal(a.immutable,true);
    return {objectKey:a.objectKey,encrypted:true,public:false,sha256:createHash('sha256').update(a.bytes).digest('hex')}},
   async getPrivate(){throw Error('not used')}}});
 const bytes=Buffer.from('Hello'),sha256=createHash('sha256').update(bytes).digest('hex');
 const staged=await store.stagePrivate({jobId,customerId,format:'html',
  bytes,contentType:'text/html; charset=utf-8',sizeBytes:bytes.length,sha256});
 assert.equal(staged.stageId,stageId);
 assert.match(objectKey,/^orgaiz\/private\/staging\/[0-9a-f]{64}$/);
 assert.equal(db.calls[db.calls.length-1].sql,'COMMIT');
});
test('revoked artifact cannot be downloaded even with a forged authorization grant',async()=>{
 let fetched=0;
 const db=stubDb(sql=>sql.includes('SELECT a.id,a.encrypted_object_key')?
  rows({id:artifactId,objectKey:'private/key',sha256:'a'.repeat(64),format:'html',
   revokedAt:new Date(),expiresAt:new Date((now+300)*1000),
   jobState:'completed',orderState:'completed',customerStatus:'active'}):rows(null));
 const store=createGaizPrivateArtifactStore({enabled:true,pool:db.pool,
  objectStore:{async putEncrypted(){},async getPrivate(){fetched++}}});
 await assert.rejects(store.readAuthorized({
  authorized:true,artifactId,jobId,orderId,authorizedCustomerId:customerId,format:'html'
 }));
 assert.equal(fetched,0);
 assert.equal(db.calls[db.calls.length-1].sql,'ROLLBACK');
});
test('authorized private download rehashes bytes and requires completed order',async()=>{
 const bytes=Buffer.from('safe report'),sha256=createHash('sha256').update(bytes).digest('hex');
 const db=stubDb(sql=>sql.includes('SELECT a.id,a.encrypted_object_key')?
  rows({id:artifactId,objectKey:'orgaiz/private/key',sha256,format:'pdf',
   revokedAt:null,expiresAt:new Date(Date.now()+86400000),
   jobState:'completed',orderState:'completed',customerStatus:'active'}):rows(null));
 const store=createGaizPrivateArtifactStore({enabled:true,pool:db.pool,
  objectStore:{async putEncrypted(){},async getPrivate(arg){
   assert.equal(arg.allowPublic,false);
   return {bytes};
  }}});
 const result=await store.readAuthorized({
  authorized:true,artifactId,jobId,orderId,authorizedCustomerId:customerId,format:'pdf'
 });
 assert.equal(result.cacheControl,'no-store');
 assert.equal(result.downloadDisposition,'attachment');
 assert.equal(result.bytes.toString(),'safe report');
 assert.equal(db.calls[db.calls.length-1].sql,'COMMIT');
});
