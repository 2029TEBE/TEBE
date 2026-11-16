// Injected durable ORGAIZ Paddle event processor. NOT a public webhook route.
// Verification is on exact raw bytes BEFORE parsing or looking up an order.
// Storage MUST transactionally claim event_id once, load canonical binding
// under row lock, apply CAS transition, append immutable audit, then commit.
import {classifySignedGaizPaddleEvent,bindSignedGaizPaddlePayment}
 from './gaiz-paddle-notification.mjs';
import {transitionGaizOrder} from './gaiz-commercial-policy.mjs';

const fail=()=>{throw Error('ORGAIZ Paddle processing unavailable')};
export function createGaizPaddleEventProcessor({
 enabled=false,webhookSecret,environment,store,audit
}={}){
 if(enabled!==true||typeof webhookSecret!=='string'||webhookSecret.length<16||
 !['sandbox','live'].includes(environment)||
 !store||typeof store.consumeSignedEventAtomically!=='function'||
 !audit||typeof audit.recordInTransaction!=='function')fail();
 return Object.freeze({
  async receive({rawBody,signatureHeader,nowMs}={}){
   const e=classifySignedGaizPaddleEvent({
    rawBody,signatureHeader,secret:webhookSecret,nowMs
   });
   if(e.action==='ignore')return Object.freeze({accepted:true,action:'ignored'});
   // All valid but non-successful payment/adjustment events require durable
   // reconciliation; ignoring a refund event must never perpetuate access.
   return store.consumeSignedEventAtomically({
    eventId:e.eventId,eventSha256:e.eventSha256??null,
    eventType:e.eventType??null,providerTransactionId:e.providerTransactionId??null,
    providerAdjustmentId:e.providerAdjustmentId??null,
    environment,
    perform:async({binding,order,recordAudit}={})=>{
     if(typeof recordAudit!=='function'||!order||!binding)fail();
     if(e.action==='reconcile'){
      await recordAudit({kind:'orgaiz.payment.reconciliation_required',
       orderId:order.id,eventId:e.eventId});
      return Object.freeze({action:'reconcile',orderId:order.id});
     }
     const proof=bindSignedGaizPaddlePayment({event:e,binding,environment});
     if(order.id!==proof.orderId||order.customerId!==proof.customerId||
       order.providerTransactionId!==proof.providerTransactionId||
       order.amountMinor!==proof.amountMinor||order.currency!==proof.currency)fail();
     // A signed transaction event has no user session. This explicitly
     // authenticated system principal is constructed INSIDE the trusted
     // transaction adapter from the canonical order; never HTTP JSON.
     const principal={
      authenticated:true,identityProvider:'oidc',epmoTenantBound:false,
      customerId:order.customerId,userId:order.customerId,
      issuer:'internal.payment-processor',subject:'paddle-webhook',
      sessionId:'system.payment-worker'
     };
     const next=transitionGaizOrder({
      principal,order,nextState:'paid',
      expectedRevision:order.revision,paymentProof:proof
     });
     await recordAudit({kind:'orgaiz.payment.completed',
      orderId:order.id,eventId:e.eventId,customerId:order.customerId});
     return Object.freeze({action:'apply',order:next,eventId:e.eventId});
    }
   });
  }
 });
}
