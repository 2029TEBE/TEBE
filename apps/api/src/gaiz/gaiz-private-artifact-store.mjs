// Review-only PRIVATE GAIZ object-store adapter.
// Requires a dedicated encrypted storage driver and a transaction-safe DB role.
// No public bucket, presigned URL, provider credentials or controller is created.
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
const deny=()=>{throw Error('GAIZ private artifact unavailable')};
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const supported={html:'text/html; charset=utf-8',pdf:'application/pdf',gaiz:'application/octet-stream'};
const hash=x=>createHash('sha256').update(x).digest('hex');
const one=r=>r&&Array.isArray(r.rows)&&r.rows.length===1?r.rows[0]:null;
function fixedEqual(a,b){
 if(!sha(a)||!sha(b))deny();
 return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
export function createGaizPrivateArtifactStore({
 enabled=false,pool,objectStore,maxBytes=10_000_000
}={}){
 if(enabled!==true||!pool||typeof pool.connect!=='function'||
    !objectStore||typeof objectStore.putEncrypted!=='function'||
    typeof objectStore.getPrivate!=='function'||
    !Number.isSafeInteger(maxBytes)||maxBytes<1024||
    maxBytes>10_000_000)deny();
 async function tx(callback){
  const c=await pool.connect();let open=false;
  if(!c||typeof c.query!=='function'||typeof c.release!=='function')deny();
  try{await c.query('BEGIN');open=true;
   const answer=await callback(c);
   await c.query('COMMIT');open=false;return answer;
  }catch{if(open){try{await c.query('ROLLBACK')}catch{}}deny()}
  finally{c.release()}
 }
 return Object.freeze({
  async stagePrivate(input){
   const {jobId,customerId,format,bytes,contentType,sha256,sizeBytes}=input||{};
   if(!uuid(jobId)||!uuid(customerId)||supported[format]!==contentType||
      !Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>maxBytes||
      sizeBytes!==bytes.length||!fixedEqual(hash(bytes),sha256))deny();
   // Only server-generated keys; never accept a client-supplied path.
   const objectKey='orgaiz/private/staging/'+randomBytes(32).toString('hex');
   const stored=await objectStore.putEncrypted({
    objectKey,bytes,contentType,immutable:true,public:false
   });
   if(!stored||stored.encrypted!==true||stored.public!==false||
      stored.objectKey!==objectKey||stored.sha256!==sha256)deny();
   // Metadata insertion must be a committed transaction before returning
   // a staged pointer. Orphaned immutable blobs need TTL garbage collection.
   const stage=await tx(async c=>one(await c.query(
     `INSERT INTO orgaiz_artifact_staging
       (job_id,customer_id,format,sha256,size_bytes,encrypted_object_key,state)
      VALUES($1,$2,$3,$4,$5,$6,'staged')
      RETURNING id,job_id AS "jobId",customer_id AS "customerId",sha256`,
     [jobId,customerId,format,sha256,sizeBytes,objectKey])));
   if(!stage||!uuid(stage.id)||stage.jobId!==jobId||
      stage.customerId!==customerId||stage.sha256!==sha256)deny();
   return Object.freeze({stageId:stage.id,jobId,customerId,sha256});
  },
  async getMetadata(artifactId,customerId){
   if(!uuid(artifactId)||!uuid(customerId))deny();
   // Metadata is untrusted until rechecked together with live order/job
   // and current customer session by the delivery/readAuthorized path.
   const c=await pool.connect();
   try{
    const r=one(await c.query(
     `SELECT a.id,a.job_id AS "jobId",a.customer_id AS "customerId",
       a.format,a.sha256,a.expires_at AS "expiresAt",
       a.revoked_at AS "revokedAt",
       j.order_id AS "orderId"
      FROM orgaiz_artifacts a JOIN orgaiz_jobs j ON j.id=a.job_id
      WHERE a.id=$1 AND a.customer_id=$2`,[artifactId,customerId]));
    return r;
   }finally{c.release()}
  },
  async readAuthorized(grant){
   if(!grant||grant.authorized!==true||
    !uuid(grant.artifactId)||!uuid(grant.jobId)||
    !uuid(grant.orderId)||!uuid(grant.authorizedCustomerId)||
    !supported[grant.format])deny();
   // Lock order+job+artifact+customer and revalidate until bytes are read,
   // preventing a concurrent refund/revoke from completing before this read.
   return tx(async c=>{
    const a=one(await c.query(
     `SELECT a.id,a.encrypted_object_key AS "objectKey",a.sha256,
       a.format,a.revoked_at AS "revokedAt",a.expires_at AS "expiresAt",
       j.state AS "jobState",o.state AS "orderState",cu.status AS "customerStatus"
      FROM orgaiz_artifacts a
      JOIN orgaiz_jobs j ON j.id=a.job_id AND j.customer_id=a.customer_id
      JOIN orgaiz_orders o ON o.id=j.order_id AND o.customer_id=a.customer_id
      JOIN orgaiz_customers cu ON cu.id=a.customer_id
      WHERE a.id=$1 AND j.id=$2 AND o.id=$3 AND a.customer_id=$4
      FOR UPDATE OF a,j,o,cu`,
     [grant.artifactId,grant.jobId,grant.orderId,grant.authorizedCustomerId]));
    if(!a||a.format!==grant.format||a.revokedAt!==null||
       Date.parse(a.expiresAt)<=Date.now()||
       a.jobState!=='completed'||a.orderState!=='completed'||
       a.customerStatus!=='active'||!sha(a.sha256))deny();
    const loaded=await objectStore.getPrivate({
     objectKey:a.objectKey,maxBytes,allowPublic:false
    });
    if(!loaded||!Buffer.isBuffer(loaded.bytes)||
       loaded.bytes.length<1||loaded.bytes.length>maxBytes||
       !fixedEqual(hash(loaded.bytes),a.sha256))deny();
    return Object.freeze({bytes:loaded.bytes,format:a.format,
      contentType:supported[a.format],sha256:a.sha256,
      downloadDisposition:'attachment',cacheControl:'no-store'});
   });
  }
 });
}
