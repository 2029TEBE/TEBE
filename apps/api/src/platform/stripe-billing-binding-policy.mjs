// Pure server-owned Stripe Billing registry lookup contract. No database,
// Stripe SDK, network, webhook, or entitlement writes.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const names={
 account:/^acct_[A-Za-z0-9]+$/,customer:/^cus_[A-Za-z0-9]+$/,
 subscription:/^sub_[A-Za-z0-9]+$/,price:/^price_[A-Za-z0-9]+$/,
 checkout:/^cs_(test_|live_)[A-Za-z0-9]+$/,
};
function deny(){throw Error('Stripe Billing server binding rejected');}
export function verifyServerOwnedStripeBillingBinding({
 tenantId,planId,accountId,livemode,customerId,subscriptionId,
 checkoutSessionId,stripePriceId,catalogueRevision,approvedPrice,binding,
}={}){
 if(!UUID.test(tenantId)||!UUID.test(planId)||
    !names.account.test(accountId)||typeof livemode!=='boolean'||
    !names.customer.test(customerId)||!names.subscription.test(subscriptionId)||
    !names.checkout.test(checkoutSessionId)||
    checkoutSessionId.startsWith('cs_live_')!==livemode||
    !names.price.test(stripePriceId)||
    !Number.isSafeInteger(catalogueRevision)||catalogueRevision<1||
    !approvedPrice||!binding)deny();
 if(approvedPrice.status!=='approved'||
    approvedPrice.tenantId!==undefined||
    approvedPrice.accountId!==accountId||
    approvedPrice.livemode!==livemode||
    approvedPrice.planId!==planId||
    approvedPrice.stripePriceId!==stripePriceId||
    approvedPrice.catalogueRevision!==catalogueRevision||
    !(approvedPrice.approvedBy&&approvedPrice.approvedAt)||
    approvedPrice.approvedBy===approvedPrice.requestedBy)deny();
 if(binding.tenantId!==tenantId||binding.planId!==planId||
    binding.accountId!==accountId||binding.livemode!==livemode||
    binding.customerId!==customerId||binding.subscriptionId!==subscriptionId||
    binding.checkoutSessionId!==checkoutSessionId||
    binding.stripePriceId!==stripePriceId||
    binding.catalogueRevision!==catalogueRevision||
    !['pending_verification','verified'].includes(binding.status))deny();
 return Object.freeze({tenantId,planId,accountId,livemode,customerId,
   subscriptionId,stripePriceId,catalogueRevision,
   bindingValidated:true,entitlementAllowed:false,checkoutStarted:false});
}
