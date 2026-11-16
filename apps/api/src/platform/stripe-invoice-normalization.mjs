/**
 * Strict Stripe Invoice/Subscription references normalization.
 * Supports legacy and 2025-03-31.basil+ invoice shapes, but rejects
 * conflicting references rather than preferring one silently.
 * Do not use as settlement proof without signed event + authenticated Stripe
 * GET request + tenant binding + durable idempotent transaction.
 */
function deny(message){throw Error('Unverifiable Stripe Billing invoice: '+message);}
const ID=/^sub_[A-Za-z0-9]+$/;
const PRICE=/^price_[A-Za-z0-9]+$/;
const CUSTOMER=/^cus_[A-Za-z0-9]+$/;
const stringId=value=>typeof value==='string'?value:
  value&&typeof value==='object'&&typeof value.id==='string'?value.id:null;
export function extractStripeInvoiceSubscription(invoice){
 const legacy=stringId(invoice?.subscription);
 const modern=stringId(invoice?.parent?.subscription_details?.subscription);
 const ids=[legacy,modern].filter(x=>x!==null);
 if(ids.length===0||ids.some(x=>!ID.test(x))||
    ids.some(x=>x!==ids[0]))deny('missing or conflicting subscription reference');
 return ids[0];
}
export function extractStripeInvoicePrice(invoice){
 const lines=invoice?.lines;
 if(!lines||lines.has_more===true||!Array.isArray(lines.data)||
    lines.data.length!==1)deny('single complete subscription line required');
 const line=lines.data[0];
 const legacy=stringId(line?.price);
 const modern=stringId(line?.pricing?.price_details?.price);
 const ids=[legacy,modern].filter(x=>x!==null);
 if(ids.length===0||ids.some(x=>!PRICE.test(x))||
    ids.some(x=>x!==ids[0]))deny('missing or conflicting price reference');
 if(line.quantity!==1)deny('unexpected price quantity');
 return ids[0];
}
export function extractStripeSubscriptionPeriod(subscription){
 const items=subscription?.items;
 const item=items?.data?.length===1&&!items?.has_more?items.data[0]:null;
 const rootStart=subscription?.current_period_start;
 const rootEnd=subscription?.current_period_end;
 const itemStart=item?.current_period_start;
 const itemEnd=item?.current_period_end;
 if(rootStart!==undefined&&itemStart!==undefined&&rootStart!==itemStart)
  deny('conflicting period start');
 if(rootEnd!==undefined&&itemEnd!==undefined&&rootEnd!==itemEnd)
  deny('conflicting period end');
 const start=rootStart??itemStart;
 const end=rootEnd??itemEnd;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||
    start<1||end<=start)deny('invalid subscription service period');
 return Object.freeze({start,end});
}
export function normalizeStripePaidInvoiceEvidence(invoice,subscription){
 if(!invoice||invoice.object!=='invoice'||!/^in_[A-Za-z0-9]+$/.test(invoice.id)||
    invoice.status!=='paid'||invoice.paid===false||
    (invoice.amount_remaining!==undefined&&invoice.amount_remaining!==0)||
    !CUSTOMER.test(stringId(invoice.customer))||
    !Number.isSafeInteger(invoice.amount_paid)||invoice.amount_paid<=0||
    typeof invoice.currency!=='string'||!/^[a-z]{3}$/.test(invoice.currency))
  deny('invoice has not been paid or has invalid identity');
 const subId=extractStripeInvoiceSubscription(invoice);
 const priceId=extractStripeInvoicePrice(invoice);
 if(!subscription||subscription.object!==undefined&&subscription.object!=='subscription'||
    subscription.id!==subId||subscription.customer!==stringId(invoice.customer)||
    subscription.status!=='active')
  deny('subscription identity or state mismatch');
 const period=extractStripeSubscriptionPeriod(subscription);
 return Object.freeze({
  invoiceId:invoice.id,subscriptionId:subId,
  customerId:stringId(invoice.customer),
  priceId,currency:invoice.currency,
  paidMinor:invoice.amount_paid,periodStart:period.start,periodEnd:period.end
 });
}
