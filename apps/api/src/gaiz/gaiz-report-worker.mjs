// GAIZ report execution worker: source-only; not mounted or scheduled.
// Jobs are CLAIMED by a trusted atomic store, never sent by a browser.
// The store must fence stale leases and atomically commit artifact metadata,
// job state, order transition and audit after private object staging.
import {createHash} from 'node:crypto';
const deny=()=>{throw Error('GAIZ report execution unavailable')};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const token=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{32,128}$/.test(x);
const digest=b=>createHash('sha256').update(b).digest('hex');
const formats=new Set(['html','pdf','gaiz']);
const methods=['claimNext','confirmEntitlement','completeWithArtifact','failClaim'];
function assertClaim(c){
 if(!c||!id(c.id)||!id(c.orderId)||!id(c.customerId)||!id(c.toolId)||
    !id(c.workerKey)||!token(c.leaseToken)||!formats.has(c.format)||
    !Number.isSafeInteger(c.deadlineEpoch)||c.deadlineEpoch<=0||
    !c.inputs||typeof c.inputs!=='object'||Array.isArray(c.inputs))deny();
 // A worker request is JSON data, not a command, source code or filename.
 let bytes;try{bytes=Buffer.byteLength(JSON.stringify(c.inputs),'utf8')}catch{deny()}
 if(bytes>65536)deny();
 return c;
}
function output(v,format,maxOutputBytes){
 if(!v||v.format!==format||!Buffer.isBuffer(v.bytes)||v.bytes.length<1||
    v.bytes.length>maxOutputBytes||typeof v.contentType!=='string')deny();
 const contentTypes={html:'text/html; charset=utf-8',pdf:'application/pdf',gaiz:'application/octet-stream'};
 if(v.contentType!==contentTypes[format])deny();
 if(format==='pdf'&&!v.bytes.subarray(0,5).equals(Buffer.from('%PDF-')))deny();
 // A valid .gaiz signature/recipient binding is a separate required verifier
 // and must be performed by the trusted handler/storage layer.
 return Object.freeze({bytes:v.bytes,format,contentType:v.contentType,
  sha256:digest(v.bytes),sizeBytes:v.bytes.length});
}
/**
 * Invariant: every production call must have an atomic store implementing
 * token-fenced claims, independent entitlement checks and conditional commit.
 * Run only a fixed handler for a known tool; never resolve worker modules
 * from the untrusted tool name or execute arbitrary user-supplied code.
 */
export function createGaizReportWorker({
 enabled=false,queue,artifactStore,handlers,
 clock=()=>Math.floor(Date.now()/1000),maxOutputBytes=2_000_000
}={}){
 if(enabled!==true||!queue||methods.some(k=>typeof queue[k]!=='function')||
    !artifactStore||typeof artifactStore.stagePrivate!=='function'||
    !handlers||typeof handlers!=='object'||Array.isArray(handlers)||
    !Number.isSafeInteger(maxOutputBytes)||maxOutputBytes<1024||
    maxOutputBytes>10_000_000||typeof clock!=='function')deny();
 const keys=Object.keys(handlers);
 if(keys.length<1||keys.length>100||keys.some(k=>!id(k)||typeof handlers[k]!=='function'))deny();
 const registry=new Map(keys.map(k=>[k,handlers[k]]));
 return Object.freeze({
  async runOnce(){
   const claimed=await queue.claimNext();
   if(claimed===null)return Object.freeze({status:'empty'});
   const job=assertClaim(claimed);
   let staged=null;
   try {
    const now=clock();
    if(!Number.isSafeInteger(now)||now>=job.deadlineEpoch)deny();
    const verified=await queue.confirmEntitlement({
     jobId:job.id,leaseToken:job.leaseToken,orderId:job.orderId,
     customerId:job.customerId,toolId:job.toolId
    });
    if(!verified||verified.verifiedByServer!==true||
       verified.paidOrder!==true||verified.entitled!==true||
       verified.orderId!==job.orderId||verified.customerId!==job.customerId||
       verified.jobId!==job.id||verified.toolId!==job.toolId||
       verified.orderState!=='processing')deny();
    const handler=registry.get(job.workerKey);
    if(!handler)deny();
    const result=output(await handler(Object.freeze({
     inputs:structuredClone(job.inputs),format:job.format,toolId:job.toolId
    })),job.format,maxOutputBytes);
    if(clock()>=job.deadlineEpoch)deny();
    staged=await artifactStore.stagePrivate({
      jobId:job.id,orderId:job.orderId,customerId:job.customerId,
      leaseToken:job.leaseToken,format:result.format,
      contentType:result.contentType,bytes:result.bytes,
      sha256:result.sha256,sizeBytes:result.sizeBytes
    });
    if(!staged||!id(staged.stageId)||staged.sha256!==result.sha256||
       staged.customerId!==job.customerId||staged.jobId!==job.id)deny();
    // DB must recheck paid entitlement, revocation, lease, expiry and job
    // transition IN ONE TRANSACTION before committing the artifact pointer.
    const committed=await queue.completeWithArtifact({
      jobId:job.id,orderId:job.orderId,customerId:job.customerId,
      leaseToken:job.leaseToken,stageId:staged.stageId,
      sha256:result.sha256,format:job.format,sizeBytes:result.sizeBytes
    });
    if(!committed||committed.committed!==true)deny();
    return Object.freeze({status:'completed',jobId:job.id});
   }catch {
    // Do not delete staged bytes on an uncertain DB commit response: a crash\n    // after COMMIT could leave a legitimate artifact pointer. Staged object\n    // cleanup is an independent TTL/mark-and-sweep reconciliation process.
    // Fenced failure: stale workers must never overwrite a newer lease.
    try{await queue.failClaim({
     jobId:job.id,leaseToken:job.leaseToken,reasonCode:'execution_failed'
    })}catch{}
    return Object.freeze({status:'failed',jobId:job.id});
   }
  }
 });
}
