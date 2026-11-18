// INERT, review-only PostgreSQL adapter for the GAIZ report worker.
// Requires the PROPOSED worker schema and a reviewed least-privilege DB role.
// No automatic migrations, timers, production connection or public HTTP route.
import {createHash,randomBytes} from 'node:crypto';
const fail=()=>{throw Error('GAIZ queue unavailable')};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const key=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const hash=x=>createHash('sha256').update('orgaiz:lease:v1:'+x).digest('hex');
const digest=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const token=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{43}$/.test(x);
const epoch=x=>Math.floor(new Date(x).getTime()/1000);
const row=r=>Array.isArray(r?.rows)&&r.rows.length===1?r.rows[0]:null;
export function createGaizPostgresWorkerQueue({
 enabled=false,pool,clock=()=>Math.floor(Date.now()/1000),
 maxAttempts=3,leaseSeconds=180
}={}){
 if(enabled!==true||!pool||typeof pool.connect!=='function'||
   typeof clock!=='function'||!Number.isSafeInteger(maxAttempts)||
   maxAttempts<1||maxAttempts>10||!Number.isSafeInteger(leaseSeconds)||
   leaseSeconds<30||leaseSeconds>900)fail();
 const now=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<1700000000)fail();return n};
 const date=s=>new Date(s*1000);
 async function tx(work){
  const client=await pool.connect();let open=false;
  if(!client||typeof client.query!=='function'||typeof client.release!=='function')fail();
  try {
   await client.query('BEGIN');open=true;
   const value=await work(client);
   await client.query('COMMIT');open=false;return value;
  }catch{
   if(open){try{await client.query('ROLLBACK')}catch{}}
   fail();
  }finally{client.release()}
 }
 function claimValid(x){
  if(!x||!uuid(x.jobId)||!uuid(x.orderId)||!uuid(x.customerId)||
    !token(x.leaseToken))fail();
  return x;
 }
 async function locked(client,c){
  claimValid(c);
  // Lock the row so old workers cannot complete after a lease has expired
  // and a newer worker has already claimed the job.
  const r=row(await client.query(
   `SELECT j.id,j.order_id AS "orderId",j.customer_id AS "customerId",
     j.tool_id AS "toolId",j.state,j.lease_digest AS "leaseDigest",
     j.lease_expires_at AS "leaseExpiresAt",o.state AS "orderState",
     o.revision,o.customer_id AS "orderCustomerId",
     c.status AS "customerStatus"
    FROM orgaiz_jobs j
    JOIN orgaiz_orders o ON o.id=j.order_id
    JOIN orgaiz_customers c ON c.id=j.customer_id
    WHERE j.id=$1 FOR UPDATE OF j,o,c`,[c.jobId]));
  if(!r||r.orderId!==c.orderId||r.customerId!==c.customerId||
    r.orderCustomerId!==c.customerId||r.state!=='processing'||
    r.leaseDigest!==hash(c.leaseToken)||
    !(epoch(r.leaseExpiresAt)>now()))fail();
  return r;
 }
 return Object.freeze({
  async claimNext(){
   return tx(async client=>{
    const current=now(),until=current+leaseSeconds;
    // SKIP LOCKED prevents multiple workers taking the same live lease.
    // Expired processing leases can be reclaimed with strictly fenced tokens.
    const r=row(await client.query(
     `SELECT j.id,j.order_id AS "orderId",j.customer_id AS "customerId",
       j.tool_id AS "toolId",j.worker_key AS "workerKey",j.format,
       j.inputs,j.attempts,j.deadline_at AS "deadlineAt",
       o.state AS "orderState",o.revision
      FROM orgaiz_jobs j JOIN orgaiz_orders o
       ON o.id=j.order_id AND o.customer_id=j.customer_id
      JOIN orgaiz_customers c ON c.id=j.customer_id
      WHERE c.status='active' AND
       ((j.state='queued' AND o.state='queued') OR
        (j.state='processing' AND o.state='processing' AND j.lease_expires_at <= $1))
       AND j.attempts < $2 AND j.deadline_at > $1
      ORDER BY j.created_at,j.id
      FOR UPDATE OF j,o SKIP LOCKED LIMIT 1`,[date(current),maxAttempts]));
    if(!r)return null;
    if(!uuid(r.id)||!uuid(r.orderId)||!uuid(r.customerId)||
       !key(r.toolId)||!key(r.workerKey)||!['html','pdf','gaiz'].includes(r.format))fail();
    const leaseToken=randomBytes(32).toString('base64url');
    const updated=row(await client.query(
     `UPDATE orgaiz_jobs SET state='processing',lease_digest=$2,
       lease_expires_at=$3,attempts=attempts+1
      WHERE id=$1 RETURNING id`,[r.id,hash(leaseToken),date(until)]));
    if(!updated)fail();
    if(r.orderState==='queued'){
     const changed=await client.query(
      `UPDATE orgaiz_orders SET state='processing',revision=revision+1,updated_at=now()
       WHERE id=$1 AND state='queued' AND revision=$2 RETURNING id`,
      [r.orderId,r.revision]);
     if(!row(changed))fail();
    }
    return Object.freeze({id:r.id,orderId:r.orderId,customerId:r.customerId,
     toolId:r.toolId,workerKey:r.workerKey,format:r.format,
     inputs:r.inputs,leaseToken,deadlineEpoch:epoch(r.deadlineAt)});
   });
  },
  async confirmEntitlement(c){
   claimValid(c);
   return tx(async client=>{
    const r=await locked(client,c);
    if(r.toolId!==c.toolId||r.customerStatus!=='active'||
       r.orderState!=='processing')fail();
    // This is only a candidate for "paid"; payment entitlement MUST derive
    // from a durable verified settlement or a separate authorized grant.
    const entitlement=row(await client.query(
      `SELECT id FROM orgaiz_order_entitlements
       WHERE order_id=$1 AND customer_id=$2 AND status='active'
        AND expires_at > $3 FOR UPDATE`,[c.orderId,c.customerId,date(now())]));
    if(!entitlement)fail();
    return Object.freeze({verifiedByServer:true,paidOrder:true,entitled:true,
      orderId:c.orderId,customerId:c.customerId,jobId:c.jobId,
      toolId:c.toolId,orderState:r.orderState});
   });
  },
  async completeWithArtifact(c){
   if(!c||!key(c.stageId)||!digest(c.sha256)||!uuid(c.jobId)||
      !uuid(c.orderId)||!uuid(c.customerId)||
      !['html','pdf','gaiz'].includes(c.format)||
      !Number.isSafeInteger(c.sizeBytes)||c.sizeBytes<1||c.sizeBytes>10_000_000)fail();
   return tx(async client=>{
    const r=await locked(client,c);
    if(r.orderState!=='processing'||r.customerStatus!=='active')fail();
    // Re-check revocation and entitlement at COMMIT time, not just at start.
    const entitled=row(await client.query(
      `SELECT id FROM orgaiz_order_entitlements
       WHERE order_id=$1 AND customer_id=$2 AND status='active'
        AND expires_at>$3 FOR UPDATE`,[c.orderId,c.customerId,date(now())]));
    if(!entitled)fail();
    const stage=row(await client.query(
      `SELECT id,customer_id AS "customerId",job_id AS "jobId",
       sha256,format,size_bytes AS "sizeBytes",encrypted_object_key AS "objectKey"
       FROM orgaiz_artifact_staging WHERE id=$1 AND state='staged'
       FOR UPDATE`,[c.stageId]));
    if(!stage||stage.customerId!==c.customerId||stage.jobId!==c.jobId||
      stage.sha256!==c.sha256||stage.format!==c.format||
      Number(stage.sizeBytes)!==c.sizeBytes)fail();
    const artifact=row(await client.query(
      `INSERT INTO orgaiz_artifacts
      (job_id,customer_id,format,encrypted_object_key,sha256,expires_at)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [c.jobId,c.customerId,c.format,stage.objectKey,c.sha256,date(now()+86400)]));
    if(!artifact||!uuid(artifact.id))fail();
    const job=row(await client.query(
      `UPDATE orgaiz_jobs SET state='completed',completed_at=now(),
       lease_digest=NULL,lease_expires_at=NULL
       WHERE id=$1 AND state='processing' RETURNING id`,[c.jobId]));
    const order=row(await client.query(
      `UPDATE orgaiz_orders SET state='completed',revision=revision+1,updated_at=now()
       WHERE id=$1 AND state='processing' AND revision=$2 RETURNING id`,
      [c.orderId,r.revision]));
    if(!job||!order)fail();
    const stageResult=row(await client.query(
      `UPDATE orgaiz_artifact_staging SET state='committed' WHERE id=$1
       AND state='staged' RETURNING id`,[c.stageId]));
    if(!stageResult)fail();
    await client.query(
      `INSERT INTO orgaiz_job_audit(job_id,customer_id,event_type,details)
       VALUES($1,$2,'completed',$3::jsonb)`,
      [c.jobId,c.customerId,JSON.stringify({artifactId:artifact.id,sha256:c.sha256})]);
    return Object.freeze({committed:true,artifactId:artifact.id});
   });
  },
  async failClaim(c){
   claimValid({jobId:c?.jobId,orderId:'00000000-0000-4000-8000-000000000000',
    customerId:'00000000-0000-4000-8000-000000000000',leaseToken:c?.leaseToken});
   return tx(async client=>{
    const r=row(await client.query(
      `SELECT id,order_id AS "orderId",attempts,deadline_at AS "deadlineAt"
       FROM orgaiz_jobs WHERE id=$1 AND lease_digest=$2
       AND state='processing' AND lease_expires_at>now() FOR UPDATE`,
      [c.jobId,hash(c.leaseToken)]));
    if(!r)return Object.freeze({updated:false}); // stale worker ignored
    const retry=Number(r.attempts)<maxAttempts && epoch(r.deadlineAt)>now();
    await client.query(
      `UPDATE orgaiz_jobs SET state=$2,lease_digest=NULL,lease_expires_at=NULL
       WHERE id=$1`,[c.jobId,retry?'queued':'failed']);
    const order=row(await client.query(
      `UPDATE orgaiz_orders SET state=$2,revision=revision+1,updated_at=now()
       WHERE id=$1 AND state='processing' RETURNING id`,
      [r.orderId,retry?'queued':'failed']));
    if(!order)fail();
    await client.query(
      `INSERT INTO orgaiz_job_audit(job_id,event_type,details)
       VALUES($1,$2,'{}'::jsonb)`,[c.jobId,retry?'retry':'failed']);
    return Object.freeze({updated:true,retry});
   });
  }
 });
}
