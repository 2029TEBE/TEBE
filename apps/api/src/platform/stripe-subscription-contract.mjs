// Stripe Billing subscription checkout contract, pure and NO NETWORK.
 // This is a review-only plan, NOT a checkout or entitlement-grant endpoint.
 // Server must obtain offer from approved local catalogue and durable
 // tenant/plan binding; never use client-supplied amount, price or tenant.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRICE=/^price_[A-Za-z0-9]+$/;
const CURRENCY=/^[a-z]{3}$/;
const HOST='checkout.stripe.com';
const validUrl=value=>{
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||
    u.pathname!=='/'||u.port||u.hostname.includes('localhost'))
  throw Error('Untrusted return origin');
 return u.origin;
};
const exact=(v,keys)=>{
 if(!v||Object.getPrototypeOf(v)!==Object.prototype||
    Object.keys(v).sort().join('|')!==keys.slice().sort().join('|'))
  throw Error('Unexpected subscription input');
};
export function planStripeSubscriptionCheckout({
 tenantId,planId,approvedOffer,returnOrigin,sessionActorId,
}){
 if(!UUID.test(tenantId)||!UUID.test(planId)||!UUID.test(sessionActorId))
  throw Error('Authenticated tenant-plan binding required');
 exact(approvedOffer,['planId','stripePriceId','currency','unitAmountMinor',
  'interval','approvalState','catalogueRevision']);
 if(approvedOffer.planId!==planId||approvedOffer.approvalState!=='approved'||
    !PRICE.test(approvedOffer.stripePriceId)||
    !CURRENCY.test(approvedOffer.currency)||
    !Number.isSafeInteger(approvedOffer.unitAmountMinor)||
    approvedOffer.unitAmountMinor<=0||
    !['month','year'].includes(approvedOffer.interval)||
    !Number.isSafeInteger(approvedOffer.catalogueRevision)||
    approvedOffer.catalogueRevision<1)
  throw Error('Approved and versioned server-owned Stripe price required');
 const origin=validUrl(returnOrigin);
 const params=new URLSearchParams({
  mode:'subscription',
  'line_items[0][price]':approvedOffer.stripePriceId,
  'line_items[0][quantity]':'1',
  'client_reference_id':tenantId,
  'metadata[tenantId]':tenantId,
  'metadata[planId]':planId,
  'metadata[catalogueRevision]':String(approvedOffer.catalogueRevision),
  'subscription_data[metadata][tenantId]':tenantId,
  'subscription_data[metadata][planId]':planId,
  'subscription_data[metadata][catalogueRevision]':String(approvedOffer.catalogueRevision),
  success_url:origin+'/billing?billing=success',
  cancel_url:origin+'/billing?billing=cancel',
 });
 return Object.freeze({
  provider:'stripe',mode:'subscription',tenantId,planId,
  approvedPriceId:approvedOffer.stripePriceId,
  approvedCurrency:approvedOffer.currency,
  approvedAmountMinor:approvedOffer.unitAmountMinor,
  approvedInterval:approvedOffer.interval,
  catalogueRevision:approvedOffer.catalogueRevision,
  requestBody:params.toString(),
  expectedCheckoutHost:HOST,
  checkoutCreated:false,paymentVerified:false,subscriptionActivated:false,
 });
}
export function verifyStripeSubscriptionSession(session,plan,{
 tenantId,planId,stripeCustomerId,stripeSubscriptionId,livemode,
}){
 const customer=/^cus_[A-Za-z0-9]+$/;
 const subscription=/^sub_[A-Za-z0-9]+$/;
 if(!session||!plan||!UUID.test(tenantId)||!UUID.test(planId)||
    !customer.test(stripeCustomerId)||!subscription.test(stripeSubscriptionId)||
    typeof livemode!=='boolean')throw Error('Missing server-owned binding');
 if(session.object!=='checkout.session'||session.mode!=='subscription'||
    session.status!=='complete'||session.livemode!==livemode||
    session.client_reference_id!==tenantId||
    session.metadata?.tenantId!==tenantId||
    session.metadata?.planId!==planId||
    session.customer!==stripeCustomerId||
    session.subscription!==stripeSubscriptionId||
    !/^cs_(test_|live_)[A-Za-z0-9]+$/.test(session.id)||
    session.id.startsWith('cs_live_')!==livemode||
    plan.planId!==planId||plan.approvalState!=='approved'||
    !PRICE.test(plan.stripePriceId)||
    Number(session.metadata?.catalogueRevision)!==plan.catalogueRevision)
  throw Error('Stripe session does not match approved tenant subscription binding');
 // A completed Checkout session is not sufficient proof of a paid invoice.
 return Object.freeze({sessionId:session.id,tenantId,planId,
   customerId:stripeCustomerId,subscriptionId:stripeSubscriptionId,
   invoicePaymentVerified:false,entitlementAllowed:false});
}
export const STRIPE_BILLING_EVENTS=Object.freeze([
 'checkout.session.completed','customer.subscription.created',
 'customer.subscription.updated','customer.subscription.deleted',
 'invoice.paid','invoice.payment_failed',
]);
