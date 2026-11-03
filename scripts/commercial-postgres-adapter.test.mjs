import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestWebhookDatabase} from './commercial-postgres-adapter.mjs';
test('rejects invalid schema and pool',()=>{
 assert.throws(()=>createTestWebhookDatabase(null));
 assert.throws(()=>createTestWebhookDatabase({connect(){}},{schema:'bad;DROP'}));
});
test('commits serializable tenant transaction with scoped setting and releases client',async()=>{
 const calls=[];let released=false;
 const pool={async connect(){return {async query(sql,args){calls.push([sql,args]);return {rowCount:1,rows:[{lastEventCreated:0}]};},release(){released=true}}}};
 const db=createTestWebhookDatabase(pool);
 await db.withSerializableTenantTransaction('tenant-a',async tx=>{
   await tx.lockSubscription('acct','sub');
   assert.equal(await tx.claimEvent('acct','evt','invoice.paid'),true);
   await tx.setEntitlement('acct','sub',{tenantId:'tenant-a',enabled:true,sourceEventId:'evt'});
   await tx.setSubscriptionState('acct','sub',{tenantId:'tenant-a',lastEventCreated:1,lastEventId:'evt',lastDecision:'grant'});
   await tx.finishEvent('acct','evt','grant');
 });
 assert.equal(calls[0][0],'BEGIN ISOLATION LEVEL SERIALIZABLE');
 assert.deepEqual(calls[1][1],['tenant-a']);
 assert.equal(calls.at(-1)[0],'COMMIT');
 assert.equal(released,true);
});
test('rolls back failed tenant validation and releases connection',async()=>{
 const calls=[];let released=false;
 const pool={async connect(){return {async query(sql){calls.push(sql);return {rowCount:1}},release(){released=true}}}};
 await assert.rejects(createTestWebhookDatabase(pool).withSerializableTenantTransaction('t',async tx=>{
   await tx.setEntitlement('a','s',{tenantId:'other',enabled:true,sourceEventId:'e'});
 }),/tenant mismatch/);
 assert.equal(calls.at(-1),'ROLLBACK');assert.equal(released,true);
});
test('missing subscription row fails closed and rolls back',async()=>{
 const calls=[];
 const pool={async connect(){return {async query(sql){calls.push(sql);return {rowCount:sql.includes('FOR UPDATE')?0:1}},release(){}}}};
 await assert.rejects(createTestWebhookDatabase(pool).withSerializableTenantTransaction('t',tx=>tx.lockSubscription('a','s')),/not found/);
 assert.equal(calls.at(-1),'ROLLBACK');
});
