import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {inspectSignedStripeBillingEvent,classifyBillingEventReplay} from './stripe-billing-webhook-inspector.mjs';

const secret='whsec_abcdefghijklmnopqrstuvwxyz123456';
const accountId='acct_Example123';
const now=Date.UTC(2026,10,16,12);
function make(type='invoice.paid',object={id:'in_Synthetic1',object:'invoice'},livemode=false){
 const rawBody=Buffer.from(JSON.stringify({
  id:'evt_Synthetic1',type,livemode,data:{object}
 }));
 const t=Math.floor(now/1000);
 const signatureHeader='t='+t+',v1='+createHmac('sha256',secret)
   .update(String(t)).update('.').update(rawBody).digest('hex');
 return {rawBody,signatureHeader,endpointSecret:secret,accountId,expectedLivemode:false,now};
}
test('signed paid event admitted for inspection with no entitlement',()=>{
 const e=inspectSignedStripeBillingEvent(make());
 assert.equal(e.acceptedForReview,true);
 assert.equal(e.entitlementApplied,false);
 assert.equal(e.invoiceVerified,false);
 assert.equal(e.tenantAuthenticated,false);
 assert.equal(e.payloadSha256.length,64);
 assert.deepEqual(classifyBillingEventReplay(e,null),{kind:'new',mayApply:false});
 const receipt={eventId:e.eventId,accountId:e.accountId,livemode:e.livemode,
  payloadSha256:e.payloadSha256,status:'applied'};
 assert.equal(classifyBillingEventReplay(e,receipt).kind,'duplicate-final');
 assert.equal(classifyBillingEventReplay(e,{...receipt,status:'received'}).mayApply,false);
 assert.throws(()=>classifyBillingEventReplay(e,{...receipt,payloadSha256:'0'.repeat(64)}));
 assert.throws(()=>classifyBillingEventReplay(e,{...receipt,accountId:'acct_Other'}));
});
test('tampering, invalid mode and stale signatures are rejected',()=>{
 const arg=make();
 for(const c of [
  {...arg,rawBody:Buffer.from(arg.rawBody.toString()+' ')},
  {...arg,signatureHeader:'t=1,v1='+'0'.repeat(64)},
  {...arg,expectedLivemode:true},
  {...arg,accountId:'invalid'},
  {...arg,now:now+301000},
  {...arg,rawBody:Buffer.alloc(262145)},
 ])assert.throws(()=>inspectSignedStripeBillingEvent(c));
});
test('unknown signed events still confer no payment or tenant authority',()=>{
 const x=inspectSignedStripeBillingEvent(make('account.updated',{id:'acct_Foreign',object:'account'}));
 assert.equal(x.acceptedForReview,false);
 assert.equal(x.entitlementApplied,false);
});
test('wrong object for signed invoice/subscription event is rejected',()=>{
 assert.throws(()=>inspectSignedStripeBillingEvent(make('invoice.paid',{id:'sub_Hijacked',object:'invoice'})));
 assert.throws(()=>inspectSignedStripeBillingEvent(make('customer.subscription.updated',{id:'sub_Test',object:'invoice'})));
});
