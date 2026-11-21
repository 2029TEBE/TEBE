// AO transaction-bound request reservation. REVIEW-ONLY / UNMOUNTED.
// No AO table is migrated or accessible in production by this module.
// A reservation is NEVER authority to invoke a tool or mint an approval.
import {createHash} from 'node:crypto';
const deny=()=>{throw Error('AO task reservation denied')};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const nonce=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(x);
const toolId=x=>typeof x==='string'&&/^[a-z][a-z0-9_.-]{2,79}$/.test(x);
const principal=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Reflect.ownKeys(x).every(k=>{
 const d=Object.getOwnPropertyDescriptor(x,k);
 return typeof k==='string'&&keys.includes(k)&&d?.enumerable===true&&Object.hasOwn(d,'value');
});
const sha=x=>createHash('sha256').update(x).digest('hex');
const one=r=>Array.isArray(r?.rows)&&r.rows.length===1?r.rows[0]:null;
function valid(t){
 if(!exact(t,['version','requestId','taskId','toolId','tenantId','principalId','intent','approvalId','artifactRefs'])||
  t.version!=='1.0.0'||!uuid(t.tenantId)||!principal(t.principalId)||!nonce(t.requestId)||
  !nonce(t.taskId)||!toolId(t.toolId)||!exact(t.intent,[])||Object.keys(t.intent).length!==0||
  (t.approvalId!==undefined&&t.approvalId!==null)||
  (t.artifactRefs!==undefined&&(!Array.isArray(t.artifactRefs)||t.artifactRefs.length!==0)))deny();
 return Object.freeze({
  tenantId:t.tenantId,principalId:t.principalId,toolId:t.toolId,taskId:t.taskId,
  // Hash request identifiers before persistence; do not emit credentials or client intent.
  requestHash:sha('ao-request-id:v1:'+JSON.stringify([t.tenantId,t.requestId])),
  requestDigest:sha('ao-request-body:v1:'+JSON.stringify([
   t.version,t.tenantId,t.principalId,t.toolId,t.taskId,t.requestId
  ]))
 });
}
export function createAoReviewReservation(options={}){
 // Defensive factory boundary: malformed caller configuration must not leak
 // exceptions from getters/proxies or expose trusted pool implementation.
 let enabled,pool,verifyTrustedReadInTransaction;
 try {
  if(!plain(options))deny();
  ({enabled=false,pool,verifyTrustedReadInTransaction}=options);
  if(enabled!==true||!pool||typeof pool.connect!=='function'||
   typeof verifyTrustedReadInTransaction!=='function')deny();
 } catch { deny(); }
 return Object.freeze({
  async reserve(task){
   // Normalize validation failures before opening a DB connection. Hostile
   // getters/proxies must not leak caller-controlled errors or connection data.
   let t;
   try { t=valid(task); } catch { deny(); }
   let client;
   try { client=await pool.connect(); } catch { deny(); }
   if(!client||typeof client.query!=='function'||typeof client.release!=='function'){
    if(typeof client?.release==='function'){try{await client.release()}catch{}}
    deny();
   }
   let began=false;
   try{
    await client.query('BEGIN');began=true;
    // This requires a dedicated least-privilege DB role and FORCE RLS
    // before AO request reservation can ever be mounted.
    await client.query("SELECT set_config('app.tenant_id',$1,true)",[t.tenantId]);
    // Verifier must consult locked, SERVER-OWNED membership, tool registry,
    // entitlement, subscription and account state in this same transaction.
    const admitted=await verifyTrustedReadInTransaction(client,{
     tenantId:t.tenantId,principalId:t.principalId,toolId:t.toolId,taskId:t.taskId,
     requestHash:t.requestHash
    });
    if(!exact(admitted,['verified','tenantId','principalId','toolId','risk','transport','executionSupported'])||
       admitted.verified!==true||admitted.tenantId!==t.tenantId||
       admitted.principalId!==t.principalId||admitted.toolId!==t.toolId||
       admitted.risk!=='read'||admitted.transport!=='tebe_api'||
       admitted.executionSupported!==false)deny();
    const inserted=one(await client.query(
     `INSERT INTO ao_task_reservations
      (tenant_id,request_hash,request_digest,principal_id,tool_id,task_id,state)
      VALUES($1,$2,$3,$4,$5,$6,'pending_review')
      ON CONFLICT (tenant_id,request_hash) DO NOTHING
      RETURNING request_digest AS "requestDigest",state`,
     [t.tenantId,t.requestHash,t.requestDigest,t.principalId,t.toolId,t.taskId]));
    let replayed=false;
    if(!inserted){
     // UNIQUE(tenant_id,request_hash) serializes competing inserts. A read
     // suffices once the conflicting row is committed: the restricted AO role
     // cannot UPDATE or DELETE reservations, so FOR UPDATE is both unnecessary
     // and incompatible with least-privilege SELECT/INSERT-only grants.
     replayed=true;
     const prior=one(await client.query(
      `SELECT request_digest AS "requestDigest",principal_id AS "principalId",
        tool_id AS "toolId",task_id AS "taskId",state
        FROM ao_task_reservations
        WHERE tenant_id=$1 AND request_hash=$2`,
      [t.tenantId,t.requestHash]));
     if(!prior||prior.requestDigest!==t.requestDigest||prior.principalId!==t.principalId||
        prior.toolId!==t.toolId||prior.taskId!==t.taskId||prior.state!=='pending_review')deny();
    }else if(inserted.requestDigest!==t.requestDigest||inserted.state!=='pending_review')deny();
    await client.query('COMMIT');began=false;
    return Object.freeze({status:'PENDING_REVIEW',tenantId:t.tenantId,
     requestHash:t.requestHash,replayed,executionSupported:false,grantIssued:false});
   }catch{
    if(began){try{await client.query('ROLLBACK')}catch{}}
    deny();
   }finally{
    // Pool release failures must not expose driver internals or credentials.
    try { await client.release(); } catch { deny(); }
   }
  }
 });
}
