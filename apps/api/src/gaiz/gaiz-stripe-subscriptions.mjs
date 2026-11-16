// GAIZ Stripe Billing subscriptions - candidate only, no live API calls.
// Separate from EPMO tenant subscriptions and from one-time GAIZ report orders.
const reject=()=>{throw Error('ORGAIZ Stripe subscription denied')};
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const stripeId=(prefix,x)=>typeof x==='string'&&new RegExp('^'+prefix+'_[A-Za-z0-9]{8,100}$').test(x);
const state=new Set(['active','trialing','past_due','unpaid','paused','canceled','incomplete','incomplete_expired']);
const safe=(x)=>typeof x==='string'&&x.length>0&&x.length<=128;
export function gaizStripeSubscriptionCheckout({principal,plan,customer,successUrl,cancelUrl}={}){
 if(!principal||principal.authenticated!==true||principal.identityProvider!=='oidc'||
    principal.epmoTenantBound!==false||!uuid(principal.customerId)||
    !plan||plan.active!==true||!safe(plan.id)||!stripeId('price',plan.stripePriceId)||
    !Number.isSafeInteger(plan.amountMinor)||plan.amountMinor<=0||
    !['month','year'].includes(plan.interval)||!/^[A-Z]{3}$/.test(plan.currency||'')||
    !customer||customer.customerId!==principal.customerId||!stripeId('cus',customer.stripeCustomerId)||
    customer.existingActiveSubscription===true)reject();
 let a,b;try{a=new URL(successUrl);b=new URL(cancelUrl)}catch{reject()}
 if(a.protocol!=='https:'||b.protocol!=='https:'||a.origin!==b.origin||
    a.username||b.username||a.password||b.password||a.port||b.port||
    a.hash||b.hash||a.search||b.search||
    !a.pathname.startsWith('/account/')||!b.pathname.startsWith('/account/'))reject();
 return Object.freeze({
  mode:'subscription',customer:customer.stripeCustomerId,
  line_items:[{price:plan.stripePriceId,quantity:1}],
  client_reference_id:principal.customerId,
  metadata:{orgaiz_customer_id:principal.customerId,orgaiz_plan_id:plan.id},
  subscription_data:{metadata:{orgaiz_customer_id:principal.customerId,orgaiz_plan_id:plan.id}},
  success_url:a.href,cancel_url:b.href
 });
}
/** Webhook candidate, NOT an entitlement. Only the database can prove the
 * provider customer and subscription belong to an ORGAIZ customer. */
export function gaizStripeSubscriptionCandidate({event,serverBinding,environment}={}){
 if(!event||!serverBinding||!['test','live'].includes(environment)||
    typeof event.type!=='string'||!stripeId('evt',event.id)||
    !['customer.subscription.created','customer.subscription.updated',
      'customer.subscription.deleted','invoice.payment_succeeded',
      'invoice.payment_failed'].includes(event.type))reject();
 const record=event.object;
 if(!record||typeof record!=='object'||typeof record.id!=='string'||
    typeof serverBinding.customerId!=='string'||!uuid(serverBinding.customerId)||
    serverBinding.provider!=='stripe'||serverBinding.environment!==environment||
    !stripeId('cus',serverBinding.stripeCustomerId))reject();
 if(record.livemode!==undefined&&record.livemode!==(environment==='live'))reject();
 if(record.customer!==serverBinding.stripeCustomerId)reject();
 if(event.type.startsWith('customer.subscription.')){
  if(!stripeId('sub',record.id)||record.id!==serverBinding.stripeSubscriptionId||
      !state.has(record.status)||record.items?.data?.length!==1||
      record.items.data[0]?.price?.id!==serverBinding.stripePriceId)reject();
  return Object.freeze({action:'reconcile-subscription',eventId:event.id,
   customerId:serverBinding.customerId,providerSubscriptionId:record.id,status:record.status,
   // A status alone does not authorize access. A settled invoice and a
   // still-valid subscription period must be checked inside the DB transaction.
   grantsAccess:false});
 }
 if(!stripeId('in',record.id)||record.subscription!==serverBinding.stripeSubscriptionId||
    !Number.isSafeInteger(record.amount_paid??record.amount_due)||
    record.currency?.toUpperCase()!==serverBinding.currency)reject();
 return Object.freeze({action:'reconcile-invoice',eventId:event.id,
  customerId:serverBinding.customerId,providerSubscriptionId:record.subscription,
  invoiceId:record.id,grantsAccess:false});
}
