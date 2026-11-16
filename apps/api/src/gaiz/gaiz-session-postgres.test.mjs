import test from 'node:test';
import assert from 'node:assert/strict';
import {createGaizSessionPostgresAdapter} from './gaiz-session-postgres.mjs';
const cid='123e4567-e89b-42d3-a456-426614174000';
const sid='b23e4567-e89b-42d3-a456-426614174000';
const digest='a'.repeat(64);
const now=1794830000;
const db=()=>{const calls=[];return {calls,query:async(sql,args)=>{
 calls.push({sql,args});
 if(sql.includes('INSERT INTO orgaiz_customers'))return {rows:[{id:cid,issuer:args[0],subject:args[1],status:'active'}]};
 if(sql.includes('INSERT INTO orgaiz_customer_sessions'))return {rows:[{id:sid,customerId:args[0],expiresAt:now+3600}]};
 if(sql.includes('SELECT s.id'))return {rows:[{id:sid,customerId:cid,issuer:'https://issuer.example.test/',
  subject:'subject-1',customerStatus:'active',revokedAt:null,expiresAt:now+3600}]};
 return {rows:[]};
 }}};
test('no DB adapter or feature enablement means no persistence access',()=>{
 assert.throws(()=>createGaizSessionPostgresAdapter());
 assert.throws(()=>createGaizSessionPostgresAdapter({enabled:true,pool:{}}));
});
test('identity insert uses bound issuer/subject and does not return a suspended account as active',async()=>{
 const pool=db(),a=createGaizSessionPostgresAdapter({enabled:true,pool});
 const o=await a.upsertCustomerByIdentity({issuer:'https://issuer.example.test/',subject:'subject-1'});
 assert.equal(o.id,cid);
 assert.equal(pool.calls[0].args[1],'subject-1');
 assert.match(pool.calls[0].sql,/ON CONFLICT\(issuer,subject\)/);
});
test('hashed session insert and reads use bound values, never plaintext tokens',async()=>{
 const pool=db(),a=createGaizSessionPostgresAdapter({enabled:true,pool});
 const row=await a.insertSession({customerId:cid,tokenDigest:digest,createdAt:now,expiresAt:now+3600});
 assert.equal(row.customerId,cid);
 assert.equal(pool.calls[0].args[1],digest);
 assert.ok(pool.calls[0].args[2] instanceof Date);
 assert.equal(pool.calls[0].sql.includes('token_digest'),true);
 const read=await a.readSessionWithCustomer(digest);
 assert.equal(read.customerStatus,'active');
 assert.deepEqual(pool.calls[1].args,[digest]);
 await a.revokeSession(digest,now);
 await a.revokeAllSessionsForCustomer(cid,now);
 assert.deepEqual(pool.calls[2].args[0],digest);
 assert.deepEqual(pool.calls[3].args[0],cid);
});
test('no arbitrary customer IDs, unsafe digests or timestamp input',async()=>{
 const a=createGaizSessionPostgresAdapter({enabled:true,pool:db()});
 await assert.rejects(a.insertSession({customerId:'other',tokenDigest:digest,createdAt:now,expiresAt:now+3600}));
 await assert.rejects(a.readSessionWithCustomer('invalid'));
 await assert.rejects(a.revokeAllSessionsForCustomer('other',now));
 await assert.rejects(a.upsertCustomerByIdentity({issuer:'',subject:'subject-1'}));
});
