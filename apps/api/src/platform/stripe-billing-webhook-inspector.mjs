// Review-only Stripe Billing webhook ingress. No API route, DB write or access grant.
import {createHash} from 'node:crypto';
import {verifyStripeSignature} from './stripe-policy.ts';
import {STRIPE_BILLING_EVENTS} from './stripe-subscription-contract.mjs';
const EVENT=/^evt_[A-Za-z0-9]+$/;
const ACCOUNT=/^acct_[A-Za-z0-9]+$/;
const SHA=/^[a-f0-9]{64}$/;
function deny(){throw Error('Stripe Billing webhook denied');}
export function inspectSignedStripeBillingEvent({
 rawBody,signatureHeader,endpointSecret,accountId,expectedLivemode,now=Date.now()
}={}){
 if(!Buffer.isBuffer(rawBody)||rawBody.length===0||rawBody.length>262144||
    !ACCOUNT.test(accountId)||typeof expectedLivemode!=='boolean'||
    !verifyStripeSignature(rawBody,signatureHeader,endpointSecret,now))deny();
 let event;
 try{event=JSON.parse(rawBody.toString('utf8'));}catch{deny();}
 if(!event||Array.isArray(event)||typeof event!=='object'||
    !EVENT.test(event.id)||event.livemode!==expectedLivemode||
    typeof event.type!=='string'||event.type.length>120||
    !event.data||typeof event.data!=='object'||!event.data.object)deny();
 const obj=event.data.object;
 if(!obj||typeof obj!=='object'||typeof obj.id!=='string')deny();
 if(event.type.startsWith('invoice.') &&
    (obj.object!=='invoice'||!/^in_[A-Za-z0-9]+$/.test(obj.id)))deny();
 if(event.type.startsWith('customer.subscription.') &&
    (obj.object!=='subscription'||!/^sub_[A-Za-z0-9]+$/.test(obj.id)))deny();
 if(event.type==='checkout.session.completed' &&
    (obj.object!=='checkout.session'||!/^cs_(test_|live_)[A-Za-z0-9]+$/.test(obj.id)))deny();
 return Object.freeze({
  eventId:event.id,eventType:event.type,accountId,livemode:expectedLivemode,
  stripeObjectId:obj.id,acceptedForReview:STRIPE_BILLING_EVENTS.includes(event.type),
  payloadSha256:createHash('sha256').update(rawBody).digest('hex'),
  tenantAuthenticated:false,invoiceVerified:false,entitlementApplied:false
 });
}
// A future secured worker must lock the tenant and perform receipt insertion,
// financial mutation and entitlement change in ONE transaction.
export function classifyBillingEventReplay(event,existing){
 if(!event||!EVENT.test(event.eventId)||!ACCOUNT.test(event.accountId)||
   typeof event.livemode!=='boolean'||!SHA.test(event.payloadSha256))deny();
 if(existing===null)return Object.freeze({kind:'new',mayApply:false});
 if(!existing||existing.eventId!==event.eventId||
   existing.accountId!==event.accountId||
   existing.livemode!==event.livemode||
   existing.payloadSha256!==event.payloadSha256)deny();
 if(['applied','ignored'].includes(existing.status))
  return Object.freeze({kind:'duplicate-final',mayApply:false});
 if(['received','needs_review'].includes(existing.status))
  return Object.freeze({kind:'retry-needs-reconciliation',mayApply:false});
 deny();
}
