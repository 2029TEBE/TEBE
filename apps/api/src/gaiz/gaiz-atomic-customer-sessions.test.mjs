import test from 'node:test';
import assert from 'node:assert/strict';
import {createGaizAtomicCustomerSessions} from './gaiz-atomic-customer-sessions.mjs';
const customerId='123e4567-e89b-42d3-a456-426614174000';
const sessionId='b23e4567-e89b-42d3-a456-426614174000';
const identity={identityProvider:'oidc',issuer:'https://issuer.example.test/',subject:'synthetic-sub',
 epmoTenantBound:false,gaizEntitled:false,gaizDownloadAuthorized:false,gaizImportAuthorized:false};
const now=1794830000;
function fakePool({suspended=false,failInsert=false,failCommit=false}={}){
 const calls=[],sessions=new Map();let connected=0,released=0,committed=false,rollback=false;
 let customerStatus=suspended?'suspended':'active';
 async function query(sql,args=[]){
  calls.push({sql,args});
  if(sql==='BEGIN')return {rows:[]};
  if(sql==='COMMIT'){if(failCommit)throw Error('Synthetic commit failure');committed=true;return {rows:[]}}
  if(sql==='ROLLBACK'){rollback=true;return {rows:[]}}
  if(sql.includes('INSERT INTO orgaiz_customers'))return {rows:[{id:customerId,issuer:identity.issuer,subject:identity.subject,status:customerStatus}]};
  if(sql.includes('INSERT INTO orgaiz_customer_sessions')){
   if(failInsert)throw Error('Synthetic DB insert failure');
   const record={id:sessionId,customerId,issuer:identity.issuer,subject:identity.subject,
    customerStatus,revokedAt:null,expiresAt:Math.floor(args[3].getTime()/1000)};
   sessions.set(args[1],record);
   return {rows:[{id:sessionId,customerId,expiresAt:String(record.expiresAt)}]};
  }
  if(sql.includes('SELECT s.id')){const r=sessions.get(args[0]);return {rows:r?[{...r,customerStatus,expiresAt:String(r.expiresAt)}]:[]}}
  if(sql.includes('UPDATE orgaiz_customer_sessions')){
   if(sql.includes('token_digest=$1')){const s=sessions.get(args[0]);if(s)s.revokedAt=args[1]}
   else for(const s of sessions.values())if(s.customerId===args[0])s.revokedAt=args[1];
   return {rows:[]};
  }
  return {rows:[]};
 }
 return {calls,sessions,pool:{query,async connect(){connected++;return {query,release(){released++}}}},
  status:()=>({connected,released,committed,rollback}),suspend:()=>customerStatus='suspended'};
}
function service(f){return createGaizAtomicCustomerSessions({enabled:true,pool:f.pool,clock:()=>now,ttlSeconds:3600})}
test('disabled or nontransactional pool fails closed',()=>{
 assert.throws(()=>createGaizAtomicCustomerSessions());
 assert.throws(()=>createGaizAtomicCustomerSessions({enabled:true,pool:{query:async()=>({rows:[]})}}));
});
test('callback issuance persists digest and customer in one BEGIN/COMMIT, never plaintext',async()=>{
 const f=fakePool(),s=service(f);
 await assert.rejects(s.issueFromTrustedCallback({identity}));
 const issued=await s.issueFromTrustedCallback({identity,callbackVerified:true});
 assert.match(issued.token,/^ogs1\.[A-Za-z0-9_-]{43}$/);
 assert.equal(issued.gaizEntitled,false);
 const sql=f.calls.map(x=>x.sql);
 assert.deepEqual([sql[0],sql[3]],['BEGIN','COMMIT']);
 assert.equal(f.status().released,1);
 assert.equal(f.status().committed,true);
 assert.equal(f.calls[2].args[1].length,64);
 assert.equal(f.calls[2].args[1].includes(issued.token),false);
 assert.equal((await s.requireCustomer(issued.token)).customerId,customerId);
});
test('suspended existing customers never reactivate and transaction rolls back',async()=>{
 const f=fakePool({suspended:true}),s=service(f);
 await assert.rejects(s.issueFromTrustedCallback({identity,callbackVerified:true}));
 assert.equal(f.status().rollback,true);
 assert.equal(f.status().committed,false);
 assert.equal(f.status().released,1);
 assert.equal(f.calls.some(x=>x.sql.includes('INSERT INTO orgaiz_customer_sessions')),false);
});
test('DB insert and commit failures never issue a customer bearer',async()=>{
 for(const config of [{failInsert:true},{failCommit:true}]){
  const f=fakePool(config),s=service(f);
  await assert.rejects(s.issueFromTrustedCallback({identity,callbackVerified:true}));
  assert.equal(f.status().rollback,true);
  assert.equal(f.status().released,1);
 }
});
test('authenticated session is revoked atomically across all devices',async()=>{
 const f=fakePool(),s=service(f);
 const a=await s.issueFromTrustedCallback({identity,callbackVerified:true});
 const b=await s.issueFromTrustedCallback({identity,callbackVerified:true});
 assert.notEqual(a.token,b.token);
 const out=await s.revokeAll(a.token);assert.equal(out.revoked,true);
 await assert.rejects(s.requireCustomer(a.token));
 await assert.rejects(s.requireCustomer(b.token));
});
test('suspended customer and unknown token cannot be used for logout-all',async()=>{
 const f=fakePool(),s=service(f);
 const a=await s.issueFromTrustedCallback({identity,callbackVerified:true});
 f.suspend();
 await assert.rejects(s.requireCustomer(a.token));
 await assert.rejects(s.revokeAll(a.token));
 assert.equal(f.calls.filter(x=>x.sql==='ROLLBACK').length,1);
 await assert.rejects(s.requireCustomer('invalid'));
});

test('single-session revocation invalidates only its own bearer',async()=>{
 const f=fakePool(),s=service(f);
 const a=await s.issueFromTrustedCallback({identity,callbackVerified:true});
 const b=await s.issueFromTrustedCallback({identity,callbackVerified:true});
 assert.equal((await s.revoke(a.token)).revoked,true);
 await assert.rejects(s.requireCustomer(a.token));
 assert.equal((await s.requireCustomer(b.token)).customerId,customerId);
});
test('expired customer session and missing revocation credentials are denied',async()=>{
 const f=fakePool(),s=service(f);
 const issued=await s.issueFromTrustedCallback({identity,callbackVerified:true});
 for(const record of f.sessions.values())record.expiresAt=now;
 await assert.rejects(s.requireCustomer(issued.token));
 await assert.rejects(s.revokeAll(issued.token));
 for(const invalid of ['', 'not-a-session', 'ogs1.short']){
  await assert.rejects(s.revoke(invalid));
  await assert.rejects(s.revokeAll(invalid));
 }
});
test('no session bearer can be issued from forged customer authorization flags',async()=>{
 const f=fakePool(),s=service(f);
 for(const field of ['gaizEntitled','gaizDownloadAuthorized','gaizImportAuthorized']){
  await assert.rejects(s.issueFromTrustedCallback({
   identity:{...identity,[field]:true},callbackVerified:true
  }));
 }
 assert.equal(f.calls.length,0);
});

test('invalid OIDC issuer and subject cannot issue a session',async()=>{
 const f=fakePool(),s=service(f);
 for(const invalid of [
  {...identity,issuer:'http://issuer.example.test/'},
  {...identity,issuer:'https://issuer.example.test/?untrusted=1'},
  {...identity,issuer:'https://user:pass@issuer.example.test/'},
  {...identity,issuer:'https://issuer.example.test/#fragment'},
  {...identity,subject:'../../tenant'},
  {...identity,subject:'a'.repeat(129)}
 ])await assert.rejects(s.issueFromTrustedCallback({identity:invalid,callbackVerified:true}));
 assert.equal(f.calls.length,0);
});

test('prototype-forged callback identity claims and accessors are denied before DB calls',async()=>{
 const f=fakePool(),s=service(f);
 const inherited=Object.assign(Object.create({gaizEntitled:false}),identity);
 delete inherited.gaizEntitled;
 const inheritedSubject=Object.assign(Object.create({subject:'synthetic-sub'}),identity);
 delete inheritedSubject.subject;
 const getter={...identity};
 Object.defineProperty(getter,'gaizEntitled',{enumerable:true,get(){return false}});
 const nullPrototype=Object.assign(Object.create(null),identity);
 for(const forged of [inherited,inheritedSubject,getter,nullPrototype]){
  await assert.rejects(s.issueFromTrustedCallback({identity:forged,callbackVerified:true}),
   /ORGAIZ transactional session unavailable/);
 }
 assert.equal(f.calls.length,0);
});


test('database acquisition failure redacts credentials and malformed client releases',async()=>{
 const secret='postgres://private-user:private-password@db.internal';
 const failed=createGaizAtomicCustomerSessions({enabled:true,
  pool:{query:async()=>({rows:[]}),async connect(){throw Error(secret)}},
  clock:()=>now});
 await assert.rejects(failed.issueFromTrustedCallback({identity,callbackVerified:true}),e=>{
  assert.equal(e.message,'ORGAIZ transactional session unavailable');
  assert.equal(e.message.includes(secret),false);
  return true;
 });
 let released=0;
 const malformed=createGaizAtomicCustomerSessions({enabled:true,
  pool:{query:async()=>({rows:[]}),async connect(){return {release(){released++}}}},
  clock:()=>now});
 await assert.rejects(malformed.issueFromTrustedCallback({identity,callbackVerified:true}),
  /ORGAIZ transactional session unavailable/);
 assert.equal(released,1);
});

test('database client release failure never leaks credentials or returns session bearer',async()=>{
 const f=fakePool();
 const secret='postgres://private-user:private-password@db.internal';
 const s=createGaizAtomicCustomerSessions({enabled:true,
  pool:{...f.pool,async connect(){
   const client=await f.pool.connect();
   return {...client,release(){throw Error(secret)}};
  }},clock:()=>now});
 await assert.rejects(s.issueFromTrustedCallback({identity,callbackVerified:true}),e=>{
  assert.equal(e.message,'ORGAIZ transactional session unavailable');
  assert.equal(e.message.includes(secret),false);
  return true;
 });
});
