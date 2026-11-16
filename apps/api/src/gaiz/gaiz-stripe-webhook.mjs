// GAIZ Stripe webhook verification, source only. No API routes, account
// activation, privileged database access or entitlement mutation.
import {createHmac,timingSafeEqual,createHash} from 'node:crypto';
const deny=()=>{throw Error('ORGAIZ Stripe notification rejected')};
const checkout=x=>typeof x==='string'&&/^cs_(test|live)_[A-Za-z0-9]{8,200}$/.test(x);
const event=x=>typeof x==='string'&&/^evt_[A-Za-z0-9]{8,200}$/.test(x);
const MAX=262144;
export function gaizVerifyStripeEvent({rawBody,header,webhookSecret,nowSeconds=Math.floor(Date.now()/1000),toleranceSeconds=300}={}){
 if(!Buffer.isBuffer(rawBody)||rawBody.length<1||rawBody.length>MAX||
    typeof header!=='string'||header.length<1||header.length>2048||
    typeof webhookSecret!=='string'||!/^whsec_[A-Za-z0-9_-]{16,}$/.test(webhookSecret)||
    !Number.isSafeInteger(nowSeconds)||!Number.isSafeInteger(toleranceSeconds)||
    toleranceSeconds<0||toleranceSeconds>300)deny();
 const fields=header.split(',').map(x=>x.trim());
 const ts=fields.filter(x=>/^t=\d+$/.test(x)),signatures=fields.filter(x=>/^v1=[A-Fa-f0-9]{64}$/.test(x));
 if(ts.length!==1||signatures.length===0||fields.some(x=>!/^t=\d+$|^v1=[A-Fa-f0-9]{64}$/.test(x)))deny();
 const when=Number(ts[0].slice(2));
 if(!Number.isSafeInteger(when)||when<=0||Math.abs(nowSeconds-when)>toleranceSeconds)deny();
 const signature=createHmac('sha256',webhookSecret).update(ts[0].slice(2)).update('.').update(rawBody).digest();
 if(!signatures.some(x=>{
  const found=Buffer.from(x.slice(3),'hex');
  return found.length===signature.length&&timingSafeEqual(found,signature);
 }))deny();
 let e;try{e=JSON.parse(rawBody.toString('utf8'))}catch{deny()}
 if(!e||typeof e!=='object'||Array.isArray(e)||!event(e.id)||
    typeof e.type!=='string'||typeof e.data?.object!=='object'||!e.data.object)deny();
 return Object.freeze({id:e.id,type:e.type,object:e.data.object,
   eventSha256:createHash('sha256').update(rawBody).digest('hex')});
}
/** Only a PAID completed/async-success checkout is a candidate. Webhook
 * metadata and client_reference_id are not ownership proof. */
export function gaizClassifyStripeEvent(verified){
 if(!verified||!event(verified.id))deny();
 const o=verified.object,t=verified.type;
 if(['charge.refunded','refund.created','refund.updated','charge.dispute.created',
      'payment_intent.payment_failed','checkout.session.async_payment_failed',
      'checkout.session.expired'].includes(t))
   return Object.freeze({action:'reconcile',eventId:verified.id,
     providerObjectId:typeof o?.id==='string'?o.id:null});
 if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(t))
   return Object.freeze({action:'ignore',eventId:verified.id});
 if(!o||o.object!=='checkout.session'||!checkout(o.id)||
    o.mode!=='payment'||o.payment_status!=='paid'||
    !Number.isSafeInteger(o.amount_total)||o.amount_total<1||
    !/^[a-z]{3}$/.test(o.currency||''))deny();
 return Object.freeze({action:'candidate-paid',eventId:verified.id,
  providerSessionId:o.id,amountMinor:o.amount_total,
  currency:o.currency.toUpperCase(),eventSha256:verified.eventSha256});
}
/** Binding comes exclusively from the server's transaction ledger, looked
 * up by checkout session ID. Must be used within an atomic replay-safe DB tx. */
export function gaizBindStripePayment({candidate,binding,environment}={}){
 if(!candidate||candidate.action!=='candidate-paid'||!binding||
   !['test','live'].includes(environment)||binding.environment!==environment||
   binding.provider!=='stripe'||binding.providerSessionId!==candidate.providerSessionId||
   !candidate.providerSessionId.startsWith('cs_'+environment+'_')||
   binding.amountMinor!==candidate.amountMinor||
   binding.currency!==candidate.currency||binding.state!=='awaiting_payment'||
   typeof binding.orderId!=='string'||typeof binding.customerId!=='string')deny();
 return Object.freeze({verifiedByServer:true,status:'paid',environment:'approved',
   providerTransactionId:binding.providerSessionId,orderId:binding.orderId,
   customerId:binding.customerId,amountMinor:binding.amountMinor,
   currency:binding.currency,eventId:candidate.eventId,eventSha256:candidate.eventSha256});
}
