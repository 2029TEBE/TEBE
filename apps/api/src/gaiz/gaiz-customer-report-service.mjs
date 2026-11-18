// Standalone GAIZ report customer service. SOURCE-ONLY, disabled, unregistered.
// Does not call EPMO tenant auth and never bypasses paid-entitlement checks.
import {authorizeGaizArtifact} from './gaiz-commercial-policy.mjs';
const fail=()=>{throw Error('GIZE AI report customer operation unavailable')};
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const required=(x,keys)=>x&&keys.every(k=>typeof x[k]==='function');
const formats={pdf:'application/pdf',html:'text/html; charset=utf-8',gaiz:'application/octet-stream'};
const stable=x=>typeof x==='string'&&x.length>=16&&x.length<=128&&/^[A-Za-z0-9_-]+$/.test(x);
function principal(p){
 if(!p||p.authenticated!==true||p.identityProvider!=='oidc'||
    p.epmoTenantBound!==false||!uuid(p.customerId)||
    !p.issuer||!p.subject||!p.sessionId)fail();
 return p;
}
export function createGaizCustomerReportService({
 enabled=false,sessions,catalogue,orders,jobs,artifacts,audit,
 clock=()=>Math.floor(Date.now()/1000)
}={}){
 if(enabled!==true||
    !required(sessions,['requireCustomer'])||
    !required(catalogue,['publicList','requireRequest'])||
    !required(orders,['getOrder'])||
    !required(jobs,['submitFromEntitlement','getOwnedJob'])||
    !required(artifacts,['getMetadata','readAuthorized'])||
    !required(audit,['record'])||typeof clock!=='function')fail();
 async function authenticated(sessionToken){
  if(!stable(sessionToken?.slice?.(5))||!sessionToken.startsWith('ogs1.'))fail();
  return principal(await sessions.requireCustomer(sessionToken));
 }
 const now=()=>{const t=clock();if(!Number.isSafeInteger(t)||t<1700000000)fail();return t};
 return Object.freeze({
  // Revalidate the cookie-bound customer session before any trusted catalogue lookup.
  // Return no identity data to the HTTP client; submit revalidates the session.
  async requireSession(sessionToken){
   await authenticated(sessionToken);
   return true;
  },
  async catalogue(){
   return Object.freeze({tools:catalogue.publicList()});
  },
  async submit({sessionToken,request,serverProduct,serverPolicy,orderId,idempotencyKey}={}){
   const p=await authenticated(sessionToken);
   if(!uuid(orderId)||!stable(idempotencyKey))fail();
   // Both serverProduct and serverPolicy MUST be loaded from trusted server
   // configuration / database. They must NEVER come from req.body.
   const admitted=catalogue.requireRequest({
    request,serverProduct,serverPolicy,session:p
   });
   if(admitted.customerId!==p.customerId)fail();
   const created=await jobs.submitFromEntitlement({
    customerId:p.customerId,orderId,idempotencyKey,
    toolId:admitted.toolId,workerKey:admitted.workerKey,
    productId:admitted.productId,format:admitted.format,
    inputs:structuredClone(admitted.inputs),
    priceMinor:admitted.priceMinor,currency:admitted.currency
   });
   // This adapter MUST atomically verify order ownership, current verified
   // entitlement, quota, ACTIVE customer + product, dedup, and job creation.
   // No browser claim or previously cached entitlement can authorize it.
   if(!created||!uuid(created.jobId)||created.customerId!==p.customerId||
      created.orderId!==orderId||
      !['queued','processing','completed'].includes(created.state))fail();
   await audit.record({event:'gaiz.report.submitted',customerId:p.customerId,
    jobId:created.jobId,orderId});
   return Object.freeze({jobId:created.jobId,status:created.state});
  },
  async status({sessionToken,jobId}={}){
   const p=await authenticated(sessionToken);
   if(!uuid(jobId))fail();
   const job=await jobs.getOwnedJob(jobId,p.customerId);
   if(!job||job.id!==jobId||job.customerId!==p.customerId||
      !['queued','processing','completed','failed','expired','canceled'].includes(job.state))fail();
   return Object.freeze({jobId,status:job.state});
  },
  async download({sessionToken,jobId,artifactId}={}){
   const p=await authenticated(sessionToken);
   if(!uuid(jobId)||!uuid(artifactId))fail();
   const job=await jobs.getOwnedJob(jobId,p.customerId);
   if(!job||job.id!==jobId||job.customerId!==p.customerId||
      !uuid(job.orderId)||job.state!=='completed')fail();
   const record=await orders.getOrder(job.orderId,p.customerId);
   const a=await artifacts.getMetadata(artifactId,p.customerId);
   if(!a||a.id!==artifactId||a.jobId!==jobId||a.customerId!==p.customerId||
      a.verifiedByServer!==true||a.revokedAt===undefined)fail();
   // Existing immutable policy requires completed unrefunded order, completed
   // owned job, active non-revoked verified artifact and unexpired metadata.
   const metadata={id:a.id,jobId:a.jobId,customerId:a.customerId,
    format:a.format,expiresAt:Math.floor(new Date(a.expiresAt).getTime()/1000),
    revoked:a.revokedAt!==null,verifiedByServer:a.verifiedByServer};
   const grant=authorizeGaizArtifact({
    principal:p,order:record,job,artifact:metadata,nowSeconds:now()
   });
   const delivered=await artifacts.readAuthorized(grant);
   if(!delivered||!Buffer.isBuffer(delivered.bytes)||
      delivered.format!==a.format||delivered.contentType!==formats[a.format]||
      delivered.cacheControl!=='no-store'||
      delivered.downloadDisposition!=='attachment')fail();
   await audit.record({event:'gaiz.report.download',customerId:p.customerId,
     jobId,artifactId});
   return Object.freeze({
    bytes:delivered.bytes,contentType:delivered.contentType,
    filename:'gaiz-report.'+delivered.format,
    cacheControl:'no-store',contentDisposition:'attachment'
   });
  }
 });
}
