// Adapter-based ORGAIZ fulfilment boundary. Inert until a reviewed service
// injects real server-managed session, atomic DB and provider verification.
// NEVER bind these adapters directly to an inbound JSON request or public route.
import {authorizeGaizOrderRead,authorizeGaizArtifact,transitionGaizOrder} from './gaiz-commercial-policy.mjs';
const deny=()=>{throw Error('ORGAIZ fulfilment service unavailable')};
const required=(obj,names)=>obj&&names.every(name=>typeof obj[name]==='function');
export function createGaizFulfillmentService({
 enabled=false,sessionStore,orders,paymentVerifier,jobVerifier,artifactStore,audit
}={}){
 if(enabled!==true||!required(sessionStore,['requireCustomer','requireSystemOrderOwner'])||
 !required(orders,['getOrderForUpdate','commitTransition','getOrder'])||
 !required(paymentVerifier,['verifyProviderEvent'])||
 !required(jobVerifier,['verifyExecution','getJobForOrder'])||
 !required(artifactStore,['getMetadata','readAuthorized'])||
 !required(audit,['record']))deny();
 // Implementations MUST enforce transactions, actor binding, immutable payment
 // idempotency, revocations and ownership in persistence as well as here.
 return Object.freeze({
  async orderStatus({sessionToken,orderId}={}){
   const principal=await sessionStore.requireCustomer(sessionToken);
   const record=await orders.getOrder(orderId,principal.customerId);
   return authorizeGaizOrderRead({principal,order:record});
  },
  async applyPayment({providerEventRef}={}){
   // Webhook authenticity, raw body signature and replay defense live in the
   // payment adapter, never in a caller-supplied "paid" boolean.
   const proof=await paymentVerifier.verifyProviderEvent(providerEventRef);
   if(!proof||proof.verifiedByServer!==true||!proof.orderId||
      !proof.providerTransactionId)deny();
   // Payment worker cannot impersonate a customer from external event fields:
   // load canonical ownership from the database inside a locked transaction.
   return orders.commitTransition(proof.orderId,async record=>{
    const principal=await sessionStore.requireSystemOrderOwner(record.customerId);
    const next=transitionGaizOrder({
     principal,order:record,nextState:'paid',expectedRevision:record.revision,paymentProof:proof
    });
    await audit.record({event:'orgaiz.payment.verified',orderId:record.id,customerId:record.customerId});
    return next;
   });
  },
  async completeJob({orderId,jobId}={}){
   return orders.commitTransition(orderId,async record=>{
    const principal=await sessionStore.requireSystemOrderOwner(record.customerId);
    const proof=await jobVerifier.verifyExecution({orderId:record.id,jobId,customerId:record.customerId});
    const next=transitionGaizOrder({
      principal,order:record,nextState:'completed',expectedRevision:record.revision,executionProof:proof
    });
    await audit.record({event:'orgaiz.job.completed',orderId:record.id,customerId:record.customerId});
    return next;
   });
  },
  async download({sessionToken,orderId,jobId,artifactId,nowSeconds}={}){
   const principal=await sessionStore.requireCustomer(sessionToken);
   const record=await orders.getOrder(orderId,principal.customerId);
   // Never accept a client-supplied job status or ownership record.
   const job=await jobVerifier.getJobForOrder(jobId,record.id,principal.customerId);
   const artifact=await artifactStore.getMetadata(artifactId,principal.customerId);
   const grant=authorizeGaizArtifact({principal,order:record,job,artifact,nowSeconds});
   await audit.record({event:'orgaiz.artifact.download',orderId:grant.orderId,
     artifactId:grant.artifactId,customerId:principal.customerId});
   // Store must re-check revocation/ownership atomically before streaming bytes.
   return artifactStore.readAuthorized(grant);
  }
 });
}
