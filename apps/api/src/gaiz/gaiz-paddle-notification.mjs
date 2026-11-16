// Standalone ORGAIZ Paddle webhook admission. Do not reuse EPMO tenant billing.
// Only a raw-body HMAC validated event plus a separately looked-up, immutable
// server-owned transaction binding may produce a candidate payment proof.
import {createHmac,timingSafeEqual,createHash} from 'node:crypto';
const fail=()=>{throw Error('ORGAIZ Paddle notification rejected')};
const txn=/^txn_[a-z0-9]{26}$/;
const evt=/^evt_[a-zA-Z0-9]+$/;
const safeId=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const MAX=262144;
const amount=x=>typeof x==='string'&&/^[0-9]{1,15}$/.test(x)&&Number.isSafeInteger(Number(x))&&Number(x)>0;
function verifiedEvent({rawBody,signatureHeader,secret,nowMs=Date.now(),toleranceMs=5000}={}){
 if(!Buffer.isBuffer(rawBody)||rawBody.length===0||rawBody.length>MAX||
    typeof secret!=='string'||secret.length<16||
    typeof signatureHeader!=='string'||signatureHeader.length>2048||
    !Number.isFinite(nowMs)||!Number.isSafeInteger(toleranceMs)||toleranceMs<0||
    toleranceMs>300000)fail();
 const fields=signatureHeader.split(';').map(x=>x.trim());
 const ts=fields.filter(x=>/^ts=[0-9]+$/.test(x));
 const h=fields.filter(x=>/^h1=[a-fA-F0-9]{64}$/.test(x));
 if(ts.length!==1||h.length===0||
    fields.some(x=>!/^ts=[0-9]+$|^h1=[a-fA-F0-9]{64}$/.test(x)))fail();
 const timestamp=ts[0].slice(3),seconds=Number(timestamp);
 if(!Number.isSafeInteger(seconds)||seconds<=0||
    Math.abs(nowMs-seconds*1000)>toleranceMs)fail();
 const expected=createHmac('sha256',secret).update(timestamp).update(':').update(rawBody).digest();
 if(!h.some(x=>{
   const actual=Buffer.from(x.slice(3),'hex');
   return actual.length===expected.length&&timingSafeEqual(actual,expected);
 }))fail();
 let e;try{e=JSON.parse(rawBody.toString('utf8'))}catch{fail()}
 if(!e||typeof e!=='object'||Array.isArray(e)||!evt.test(e.event_id||'')||
    typeof e.event_type!=='string'||!Number.isFinite(Date.parse(e.occurred_at))||
    !e.data||typeof e.data!=='object'||Array.isArray(e.data))fail();
 return e;
}
/** Returns an inert event classification; no entitlement changes. */
export function classifySignedGaizPaddleEvent(params={}){
 const e=verifiedEvent(params);
 if(!['transaction.completed','transaction.payment_failed','transaction.canceled',
       'transaction.updated','adjustment.updated','adjustment.created'].includes(e.event_type))
   return Object.freeze({action:'ignore',eventId:e.event_id});
 const d=e.data;
 if(e.event_type.startsWith('adjustment.')){
  // Reversal/adjustment needs independent ledger lookup and refund decision;
  // never auto-mark "paid" on an adjustment.
  return Object.freeze({action:'reconcile',eventId:e.event_id,
    providerAdjustmentId:typeof d.id==='string'?d.id:null});
 }
 if(!txn.test(d.id||''))fail();
 if(e.event_type!=='transaction.completed')return Object.freeze({
  action:'reconcile',eventId:e.event_id,providerTransactionId:d.id});
 const total=d.details?.totals?.grand_total;
 if(d.status!=='completed'||!amount(total)||!/^[A-Z]{3}$/.test(d.currency_code||''))fail();
 return Object.freeze({
  action:'candidate-paid',eventId:e.event_id,eventType:e.event_type,
  occurredAt:e.occurred_at,providerTransactionId:d.id,
  amountMinor:Number(total),currency:d.currency_code,
  eventSha256:createHash('sha256').update(params.rawBody).digest('hex')
 });
}
/** The immutable binding MUST be loaded by providerTransactionId from a
 * server-owned database after signature verification, never from custom_data. */
export function bindSignedGaizPaddlePayment({event,binding,environment}={}){
 if(!event||event.action!=='candidate-paid'||!binding||
    !safeId(binding.orderId)||!safeId(binding.customerId)||
    binding.provider!=='paddle'||binding.providerTransactionId!==event.providerTransactionId||
    binding.amountMinor!==event.amountMinor||binding.currency!==event.currency||
    !['sandbox','live'].includes(environment)||binding.environment!==environment||
    binding.state!=='awaiting_payment')fail();
 return Object.freeze({
  verifiedByServer:true,providerTransactionId:binding.providerTransactionId,
  orderId:binding.orderId,customerId:binding.customerId,
  amountMinor:binding.amountMinor,currency:binding.currency,status:'paid',
  environment:'approved',eventId:event.eventId,eventSha256:event.eventSha256,
  occurredAt:event.occurredAt
 });
}
