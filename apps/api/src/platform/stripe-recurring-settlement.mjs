// Pure recurring invoice entitlement gate. Never accept webhook JSON alone:
 // caller MUST verify Stripe signature against raw bytes, locate durable
 // server-owned tenant/customer/subscription/price binding, confirm the invoice
 // from Stripe API, and process atomically with event-id replay protection.
const STRICT_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURRENCY=/^[a-z]{3}$/;
function reject(){throw Error('Stripe Billing evidence does not authorize entitlement');}
export function evaluateStripeRecurringInvoiceEvidence({
 event,invoice,binding,subscription,verifiedSignature,verifiedStripeApi,
 alreadyProcessed,livemode,
}){
 if(verifiedSignature!==true||verifiedStripeApi!==true||alreadyProcessed!==false||
    typeof livemode!=='boolean'||!binding||!subscription||!event||!invoice)reject();
 if(event.type!=='invoice.paid'||event.livemode!==livemode||
    typeof event.id!=='string'||!/^evt_[A-Za-z0-9]+$/.test(event.id)||
    typeof binding.tenantId!=='string'||!STRICT_UUID.test(binding.tenantId)||
    typeof binding.planId!=='string'||!STRICT_UUID.test(binding.planId)||
    typeof binding.customerId!=='string'||!/^cus_[A-Za-z0-9]+$/.test(binding.customerId)||
    typeof binding.subscriptionId!=='string'||!/^sub_[A-Za-z0-9]+$/.test(binding.subscriptionId)||
    typeof binding.stripePriceId!=='string'||!/^price_[A-Za-z0-9]+$/.test(binding.stripePriceId)||
    typeof binding.currency!=='string'||!CURRENCY.test(binding.currency)||
    !Number.isSafeInteger(binding.unitAmountMinor)||binding.unitAmountMinor<1||
    !Number.isSafeInteger(binding.catalogueRevision)||binding.catalogueRevision<1)
  reject();
 if(invoice.object!=='invoice'||!/^in_[A-Za-z0-9]+$/.test(invoice.id)||
    invoice.livemode!==livemode||invoice.customer!==binding.customerId||
    invoice.subscription!==binding.subscriptionId||
    invoice.status!=='paid'||invoice.paid!==true||
    !Number.isSafeInteger(invoice.amount_paid)||invoice.amount_paid<=0||
    invoice.amount_paid!==binding.unitAmountMinor||
    invoice.currency!==binding.currency||
    !Array.isArray(invoice.lines?.data)||invoice.lines.data.length!==1||
    invoice.lines.data[0]?.price?.id!==binding.stripePriceId||
    invoice.lines.data[0]?.quantity!==1||
    subscription.id!==binding.subscriptionId||
    subscription.customer!==binding.customerId||
    subscription.status!=='active'||
    !Number.isSafeInteger(subscription.current_period_start)||
    !Number.isSafeInteger(subscription.current_period_end)||
    subscription.current_period_end<=subscription.current_period_start||
    invoice.lines.has_more===true)
  reject();
 // A pure decision cannot grant a subscription; durable RLS transaction,
 // replay ledger and a verified price binding are release gates.
 return Object.freeze({status:'eligible-for-atomic-review',
  tenantId:binding.tenantId,planId:binding.planId,
  stripeInvoiceId:invoice.id,stripeEventId:event.id,
  stripeSubscriptionId:binding.subscriptionId,
  periodStart:subscription.current_period_start,
  periodEnd:subscription.current_period_end,
  entitlementApplied:false,paymentRecorded:false});
}
