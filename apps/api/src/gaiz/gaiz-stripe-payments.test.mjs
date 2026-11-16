import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {gaizStripeCheckoutParams,gaizStripeCheckoutResponse} from './gaiz-stripe-checkout.mjs';
import {gaizVerifyStripeEvent,gaizClassifyStripeEvent,gaizBindStripePayment} from './gaiz-stripe-webhook.mjs';
import {gaizStripeSubscriptionCheckout,gaizStripeSubscriptionCandidate} from './gaiz-stripe-subscriptions.mjs';

const customerId='123e4567-e89b-42d3-a456-426614174000';
const orderId='b23e4567-e89b-42d3-a456-426614174000';
const principal={authenticated:true,identityProvider:'oidc',epmoTenantBound:false,customerId};
const order={id:orderId,customerId,toolId:'report-demo',productId:'catalog-1',
  amountMinor:1900,currency:'USD',state:'created',revision:0};
const product={active:true,stripePriceId:'price_'+'A'.repeat(12),
  toolId:'report-demo',productId:'catalog-1',amountMinor:1900,currency:'USD'};
const sessionId='cs_test_'+'S'.repeat(16);
const response={id:sessionId,object:'checkout.session',mode:'payment',
  payment_status:'unpaid',client_reference_id:orderId,
  metadata:{orgaiz_order_id:orderId},url:'https://checkout.stripe.com/c/demo-session'};
test('one-time purchases use server-owned Stripe prices; return URL proves no payment',()=>{
 const p=gaizStripeCheckoutParams({principal,order,product,
  successUrl:'https://orgaiz.example.test/account/thanks',
  cancelUrl:'https://orgaiz.example.test/account/cart'});
 assert.equal(p.mode,'payment');assert.equal(p.line_items[0].price,product.stripePriceId);
 const v=gaizStripeCheckoutResponse({response,order,environment:'test'});
 assert.equal(v.paymentVerified,false);
 assert.throws(()=>gaizStripeCheckoutParams({principal,order:{...order,amountMinor:1},product,
  successUrl:p.success_url,cancelUrl:p.cancel_url}));
 assert.throws(()=>gaizStripeCheckoutResponse({response:{...response,url:'https://attacker.example.test/c/demo'},order,environment:'test'}));
});
const secret='whsec_'+'s'.repeat(32),ts=1794830000;
const session={id:sessionId,object:'checkout.session',mode:'payment',payment_status:'paid',amount_total:1900,currency:'usd'};
const event={id:'evt_'+'Z'.repeat(12),type:'checkout.session.completed',data:{object:session}};
function signed(payload=event){
 const rawBody=Buffer.from(JSON.stringify(payload));
 return {rawBody,header:'t='+ts+',v1='+createHmac('sha256',secret).update(String(ts)).update('.').update(rawBody).digest('hex'),
 webhookSecret:secret,nowSeconds:ts};
}
test('raw Stripe HMAC must match before paid-session classification',()=>{
 const v=gaizVerifyStripeEvent(signed());
 const candidate=gaizClassifyStripeEvent(v);
 const binding={provider:'stripe',environment:'test',providerSessionId:sessionId,
  orderId,customerId,amountMinor:1900,currency:'USD',state:'awaiting_payment'};
 const proof=gaizBindStripePayment({candidate,binding,environment:'test'});
 assert.equal(proof.status,'paid');assert.equal(proof.customerId,customerId);
 assert.throws(()=>gaizVerifyStripeEvent({...signed(),rawBody:Buffer.from('{}')}));
 assert.throws(()=>gaizBindStripePayment({candidate,binding:{...binding,amountMinor:1},environment:'test'}));
 assert.throws(()=>gaizBindStripePayment({candidate,binding,environment:'live'}));
});
test('Stripe refund is only reconciliation, not paid entitlement',()=>{
 const result=gaizClassifyStripeEvent(gaizVerifyStripeEvent(
  signed({id:'evt_'+'R'.repeat(12),type:'charge.refunded',data:{object:{id:'ch_'+'B'.repeat(12)}}})
 ));
 assert.equal(result.action,'reconcile');
});
const plan={id:'pro-monthly',active:true,stripePriceId:'price_'+'B'.repeat(12),
  amountMinor:2990,currency:'USD',interval:'month'};
const customer={customerId,stripeCustomerId:'cus_'+'C'.repeat(12),existingActiveSubscription:false};
const opts={principal,plan,customer,
 successUrl:'https://orgaiz.example.test/account/billing/success',
 cancelUrl:'https://orgaiz.example.test/account/billing/cancel'};
test('future subscriptions use Stripe Billing subscription mode, not one-time checkout',()=>{
 const p=gaizStripeSubscriptionCheckout(opts);
 assert.equal(p.mode,'subscription');assert.equal(p.customer,customer.stripeCustomerId);
 assert.equal(p.subscription_data.metadata.orgaiz_customer_id,customerId);
 assert.throws(()=>gaizStripeSubscriptionCheckout({...opts,customer:{...customer,existingActiveSubscription:true}}));
 assert.throws(()=>gaizStripeSubscriptionCheckout({...opts,principal:{...principal,epmoTenantBound:true}}));
});
test('subscription webhooks require canonical customer binding and never grant on status alone',()=>{
 const binding={provider:'stripe',environment:'test',customerId,
  stripeCustomerId:customer.stripeCustomerId,stripeSubscriptionId:'sub_'+'D'.repeat(12),
  stripePriceId:plan.stripePriceId,currency:'USD'};
 const e={id:'evt_'+'E'.repeat(12),type:'customer.subscription.updated',
  object:{id:binding.stripeSubscriptionId,customer:binding.stripeCustomerId,status:'active',
   livemode:false,items:{data:[{price:{id:plan.stripePriceId}}]}}};
 const found=gaizStripeSubscriptionCandidate({event:e,serverBinding:binding,environment:'test'});
 assert.equal(found.grantsAccess,false);
 assert.throws(()=>gaizStripeSubscriptionCandidate({event:e,serverBinding:{...binding,stripeCustomerId:'cus_'+'Z'.repeat(12)},environment:'test'}));
});
