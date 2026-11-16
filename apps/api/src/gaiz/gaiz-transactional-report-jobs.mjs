// GAIZ standalone report submission: DISABLED / UNREGISTERED PostgreSQL adapter.
// All binding is derived from a locked server-owned order and verified entitlement.
// This does not connect Stripe/Paddle, create entitlements, or mount a public route.
import {createHash} from 'node:crypto';
const deny=()=>{throw Error('GAIZ report submission denied')};
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const ident=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const formats=new Set(['html','pdf','gaiz']);
const key=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(x);
const hex=x=>createHash('sha256').update(x).digest('hex');
const one=r=>Array.isArray(r?.rows)&&r.rows.length===1?r.rows[0]:null;
function validate(a){
 if(!a||!uuid(a.customerId)||!uuid(a.orderId)||!key(a.idempotencyKey)||
    !ident(a.toolId)||!ident(a.workerKey)||!ident(a.productId)||
    !formats.has(a.format)||!Number.isSafeInteger(a.priceMinor)||
    a.priceMinor<=0||!/^[A-Z]{3}$/.test(a.currency||'')||
    !a.inputs||typeof a.inputs!=='object'||Array.isArray(a.inputs))deny();
 let serialized;
 try{serialized=JSON.stringify(a.inputs);
  if(!serialized||Buffer.byteLength(serialized,'utf8')>65536)deny();
  // Reject non-JSON values, custom prototypes and non-deterministic objects.
  if(JSON.stringify(JSON.parse(serialized))!==serialized)deny();
 }catch{deny()}
 return Object.freeze({
  ...a,inputs:JSON.parse(serialized),
  requestDigest:hex('orgaiz:report:v1:'+JSON.stringify([
   a.customerId,a.orderId,a.toolId,a.productId,a.workerKey,
   a.format,a.priceMinor,a.currency,serialized
  ])),
  keyDigest:hex('orgaiz:report-idempotency:v1:'+a.idempotencyKey)
 });
}
export function createGaizTransactionalReportJobs({
 enabled=false,pool,toolPolicy,settlementVerifier,
 clock=()=>Math.floor(Date.now()/1000),deadlineSeconds=900
}={}){
 if(enabled!==true||!pool||typeof pool.connect!=='function'||
    !toolPolicy||typeof toolPolicy.verifyForOrderInTransaction!=='function'||\n    !settlementVerifier||typeof settlementVerifier.requireSettledOrderInTransaction!=='function'||
    typeof clock!=='function'||!Number.isSafeInteger(deadlineSeconds)||
    deadlineSeconds<60||deadlineSeconds>3600)deny();
 async function transaction(fn){
  const c=await pool.connect();let open=false;
  if(!c||typeof c.query!=='function'||typeof c.release!=='function')deny();
  try{
   await c.query('BEGIN');open=true;
   const result=await fn(c);
   await c.query('COMMIT');open=false;
   return result;
  }catch{
   if(open){try{await c.query('ROLLBACK')}catch{}}
   deny();
  }finally{c.release()}
 }
 return Object.freeze({
  async submitFromEntitlement(args){
   const a=validate(args),now=clock();
   if(!Number.isSafeInteger(now)||now<1700000000)deny();
   return transaction(async c=>{
    // Ownership, current customer status and mutable order revision must
    // be locked in the SAME transaction as job insert and order update.
    const order=one(await c.query(
     `SELECT o.id,o.customer_id AS "customerId",o.tool_id AS "toolId",
       o.amount_minor AS "amountMinor",o.currency,o.state,o.revision,
       cu.status AS "customerStatus"
      FROM orgaiz_orders o JOIN orgaiz_customers cu ON cu.id=o.customer_id
      WHERE o.id=$1 AND o.customer_id=$2 FOR UPDATE OF o,cu`,
     [a.orderId,a.customerId]));
    if(!order||order.customerId!==a.customerId||order.toolId!==a.toolId||
       Number(order.amountMinor)!==a.priceMinor||order.currency!==a.currency||
       order.customerStatus!=='active')deny();
    // The order row lock serializes concurrent attempts. A duplicate key
    // may replay only exactly identical request contents; never grant
    // another execution or change the prior report.
    const existing=one(await c.query(
     `SELECT j.id,j.order_id AS "orderId",j.customer_id AS "customerId",
       j.request_digest AS "requestDigest",j.state
      FROM orgaiz_jobs j
      WHERE j.customer_id=$1 AND j.order_id=$2 AND j.idempotency_digest=$3
      LIMIT 1`,[a.customerId,a.orderId,a.keyDigest]));
    if(existing){
     if(!uuid(existing.id)||existing.orderId!==a.orderId||
        existing.customerId!==a.customerId||
        existing.requestDigest!==a.requestDigest||
        !['queued','processing','completed'].includes(existing.state))deny();
     return Object.freeze({jobId:existing.id,orderId:a.orderId,
       customerId:a.customerId,state:existing.state,replayed:true});
    }
    // One report per purchased order, independently of idempotency key.
    if(order.state!=='paid')deny();
    const prior=one(await c.query(
     `SELECT id FROM orgaiz_jobs WHERE order_id=$1 LIMIT 1`,
     [a.orderId]));
    if(prior)deny();
    // Expiring, verified commercial settlement only. A web request or
    // payment-deferred synthetic report MUST NOT create this entitlement.
    const entitlement=one(await c.query(
     `SELECT e.id,e.granted_by AS "grantedBy"
      FROM orgaiz_order_entitlements e
      WHERE e.order_id=$1 AND e.customer_id=$2 AND e.status='active'
        AND e.expires_at>$3
      FOR UPDATE`,[a.orderId,a.customerId,new Date(now*1000)]));
    if(!entitlement||!uuid(entitlement.id)||
       entitlement.grantedBy!=='verified_payment')deny();\n    const settlement=await settlementVerifier.requireSettledOrderInTransaction(c,{\n      customerId:a.customerId,orderId:a.orderId,entitlementId:entitlement.id\n    });\n    if(!settlement||settlement.verifiedByServer!==true||\n       settlement.settled!==true||settlement.revoked!==false||\n       settlement.orderId!==a.orderId||settlement.customerId!==a.customerId||\n       settlement.entitlementId!==entitlement.id)deny();
    // Validate workerKey, productId, format and catalogue quota using
    // independently trusted server catalog INSIDE this DB transaction.
    const policy=await toolPolicy.verifyForOrderInTransaction(c,{
     customerId:a.customerId,orderId:a.orderId,
     toolId:a.toolId,productId:a.productId,workerKey:a.workerKey,
     format:a.format,priceMinor:a.priceMinor,currency:a.currency
    });
    if(!policy||policy.allowed!==true||policy.active!==true||
       policy.quotaAvailable!==true)deny();
    const inserted=one(await c.query(
     `INSERT INTO orgaiz_jobs
      (order_id,customer_id,state,tool_id,worker_key,format,inputs,
       deadline_at,request_digest,idempotency_digest,attempts)
      VALUES($1,$2,'queued',$3,$4,$5,$6::jsonb,$7,$8,$9,0)
      RETURNING id,order_id AS "orderId",customer_id AS "customerId",state`,
     [a.orderId,a.customerId,a.toolId,a.workerKey,a.format,
      JSON.stringify(a.inputs),new Date((now+deadlineSeconds)*1000),
      a.requestDigest,a.keyDigest]));
    if(!inserted||!uuid(inserted.id)||inserted.orderId!==a.orderId||
       inserted.customerId!==a.customerId||inserted.state!=='queued')deny();
    const updated=one(await c.query(
     `UPDATE orgaiz_orders SET state='queued',revision=revision+1,
       updated_at=now()
      WHERE id=$1 AND customer_id=$2 AND state='paid' AND revision=$3
      RETURNING id`,
     [a.orderId,a.customerId,order.revision]));
    if(!updated||updated.id!==a.orderId)deny();
    await c.query(
     `INSERT INTO orgaiz_job_audit
      (job_id,customer_id,event_type,details)
      VALUES($1,$2,'submitted',$3::jsonb)`,
     [inserted.id,a.customerId,
      JSON.stringify({orderId:a.orderId,requestDigest:a.requestDigest})]);
    return Object.freeze({jobId:inserted.id,orderId:a.orderId,
     customerId:a.customerId,state:'queued',replayed:false});
   });
  },
  async getOwnedJob(jobId,customerId){
   if(!uuid(jobId)||!uuid(customerId))deny();
   return transaction(async c=>{
    const r=one(await c.query(
     `SELECT j.id,j.order_id AS "orderId",j.customer_id AS "customerId",
        j.state FROM orgaiz_jobs j
        JOIN orgaiz_customers cu ON cu.id=j.customer_id
        WHERE j.id=$1 AND j.customer_id=$2 AND cu.status='active'`,
     [jobId,customerId]));
    if(!r||r.id!==jobId||r.customerId!==customerId||
       !uuid(r.orderId)||
       !['queued','processing','completed','failed','expired','canceled'].includes(r.state))deny();
    return Object.freeze(r);
   });
  }
 });
}
