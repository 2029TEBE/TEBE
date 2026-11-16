import test from 'node:test';
import assert from 'node:assert/strict';
import {planStripeSubscriptionCheckout,verifyStripeSubscriptionSession} from './stripe-subscription-contract.mjs';
import {evaluateStripeRecurringInvoiceEvidence} from './stripe-recurring-settlement.mjs';

const tenantId='11111111-1111-4111-8111-111111111111';
const planId='22222222-2222-4222-8222-222222222222';
const actorId='33333333-3333-4333-8333-333333333333';
const offer={planId,stripePriceId:'price_Test123',currency:'usd',
 unitAmountMinor:1499,interval:'month',approvalState:'approved',catalogueRevision:1};

test('approved server price builds hosted subscription params, never payment mode',()=>{
 const out=planStripeSubscriptionCheckout({tenantId,planId,
  sessionActorId:actorId,approvedOffer:offer,returnOrigin:'https://app.example.com'});
 const p=new URLSearchParams(out.requestBody);
 assert.equal(p.get('mode'),'subscription');
 assert.equal(p.get('line_items[0][price]'),offer.stripePriceId);
 assert.equal(p.get('metadata[tenantId]'),tenantId);
 assert.equal(p.get('subscription_data[metadata][planId]'),planId);
 assert.equal(p.has('line_items[0][price_data][unit_amount]'),false);
 assert.equal(out.checkoutCreated,false);
 assert.equal(out.subscriptionActivated,false);
});
test('unapproved prices, arbitrary origins and incorrect tenants fail closed',()=>{
 const base={tenantId,planId,sessionActorId:actorId,approvedOffer:offer,returnOrigin:'https://app.example.com'};
 for(const patch of [
  {approvedOffer:{...offer,approvalState:'pending'}},
  {approvedOffer:{...offer,stripePriceId:'unapproved'}},
  {approvedOffer:{...offer,unitAmountMinor:0}},
  {approvedOffer:{...offer,catalogueRevision:0}},
  {approvedOffer:{...offer,planId:tenantId}},
  {approvedOffer:{...offer,additional:'unsafe'}},
  {returnOrigin:'http://app.example.com'},
  {returnOrigin:'https://app.example.com.evil/path'},
  {tenantId:'attacker'},
 ])assert.throws(()=>planStripeSubscriptionCheckout({...base,...patch}));
});
const session={object:'checkout.session',mode:'subscription',status:'complete',
 livemode:false,id:'cs_test_XYZ',client_reference_id:tenantId,
 metadata:{tenantId,planId,catalogueRevision:'1'},customer:'cus_Test',
 subscription:'sub_Test'};
const bind={tenantId,planId,stripeCustomerId:'cus_Test',
 stripeSubscriptionId:'sub_Test',livemode:false};
test('checkout verified binding is still not payment authorization',()=>{
 const s=verifyStripeSubscriptionSession(session,offer,bind);
 assert.equal(s.entitlementAllowed,false);
 assert.equal(s.invoicePaymentVerified,false);
 for(const changed of [{livemode:true},{subscription:'sub_Attacker'},
    {metadata:{...session.metadata,tenantId:planId}}])
  assert.throws(()=>verifyStripeSubscriptionSession({...session,...changed},offer,bind));
});
const binding={tenantId,planId,customerId:'cus_Test',subscriptionId:'sub_Test',
 stripePriceId:'price_Test123',currency:'usd',unitAmountMinor:1499,catalogueRevision:1};
const invoice={id:'in_Test123',object:'invoice',livemode:false,
 customer:'cus_Test',subscription:'sub_Test',status:'paid',paid:true,
 amount_paid:1499,currency:'usd',lines:{has_more:false,
 data:[{price:{id:'price_Test123'},quantity:1}]}};
const subscription={id:'sub_Test',customer:'cus_Test',status:'active',
 current_period_start:1790000000,current_period_end:1792600000};
const event={id:'evt_Test123',type:'invoice.paid',livemode:false};
const verified={event,invoice,binding,subscription,verifiedSignature:true,
 verifiedStripeApi:true,alreadyProcessed:false,livemode:false};
test('paid recurring invoice passes no-write decision only after evidence verification',()=>{
 const decision=evaluateStripeRecurringInvoiceEvidence(verified);
 assert.equal(decision.status,'eligible-for-atomic-review');
 assert.equal(decision.entitlementApplied,false);
 assert.equal(decision.paymentRecorded,false);
});
test('no activation for unpaid, wrong price, replay or unverified API/signature',()=>{
 const cases=[
  {verifiedSignature:false},{verifiedStripeApi:false},{alreadyProcessed:true},
  {event:{...event,type:'checkout.session.completed'}},
  {invoice:{...invoice,status:'open'}},
  {invoice:{...invoice,amount_paid:1498}},
  {invoice:{...invoice,subscription:'sub_Attacker'}},
  {invoice:{...invoice,lines:{has_more:true,data:invoice.lines.data}}},
  {invoice:{...invoice,lines:{has_more:false,data:[{price:{id:'price_Hijack'},quantity:1}]}}},
  {subscription:{...subscription,status:'past_due'}},
 ];
 for(const patch of cases)
  assert.throws(()=>evaluateStripeRecurringInvoiceEvidence({...verified,...patch}));
});
