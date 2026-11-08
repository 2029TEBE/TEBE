/**
 * Offline-only Paddle sandbox checkout request preflight.
 *
 * The objects MUST originate from authenticated server-side tenant SQL and a
 * versioned server-side price catalogue. Do not pass browser-supplied data.
 * Nothing here calls Paddle, stores a payment or grants a subscription.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRICE=/^pri_[a-z0-9]{26}$/;
const TXN=/^txn_[a-z0-9]{26}$/;
const fail=(reason)=>({ok:false,reason,collectionEnabled:false,entitlementGranted:false});

export function preparePaddleSandboxCheckout(binding, catalogue, {now=Date.now()}={}) {
 if(!Number.isSafeInteger(now) || !binding || !catalogue ||
    binding.environment!=='sandbox' || binding.provider!=='paddle' ||
    binding.source!=='locked-tenant-record' || catalogue.source!=='server-approved-catalogue' ||
    !UUID.test(binding.intentId||'') || !UUID.test(binding.tenantId||'') ||
    !UUID.test(binding.invoiceId||'') || !UUID.test(binding.attemptId||'') ||
    !UUID.test(binding.subscriptionId||'') || !UUID.test(binding.planId||'') ||
    !UUID.test(catalogue.planId||'') || binding.planId!==catalogue.planId)
    return fail('untrusted_server_binding');
 if(!PRICE.test(catalogue.paddlePriceId||'') || catalogue.environment!=='sandbox' ||
    catalogue.isActive!==true || !Number.isSafeInteger(catalogue.amountMinor) ||
    catalogue.amountMinor<=0 || !/^[A-Z]{3}$/.test(catalogue.currency||''))
    return fail('invalid_catalogue');
 if(!Number.isSafeInteger(binding.expiresAt) || binding.expiresAt<=now ||
    binding.expiresAt>now+15*60*1000) return fail('invalid_intent_expiry');
 return {
   ok:true,provider:'paddle',environment:'sandbox',
   apiOrigin:'https://sandbox-api.paddle.com',method:'POST',endpoint:'/transactions',
   request:{items:[{price_id:catalogue.paddlePriceId,quantity:1}],
     collection_mode:'automatic',
     custom_data:{epmo_intent_id:binding.intentId,
       epmo_attempt_id:binding.attemptId,epmo_invoice_id:binding.invoiceId,
       epmo_tenant_id:binding.tenantId}},
   expected:{intentId:binding.intentId,tenantId:binding.tenantId,
     attemptId:binding.attemptId,invoiceId:binding.invoiceId,
     subscriptionId:binding.subscriptionId,planId:binding.planId,
     priceId:catalogue.paddlePriceId,amountMinor:catalogue.amountMinor,
     currency:catalogue.currency,expiresAt:binding.expiresAt},
   collectionEnabled:false,entitlementGranted:false,
 };
}

/** Check only a trusted *sandbox* transaction response, never activate access. */
export function validatePaddleSandboxTransaction(prepared, response) {
 if(!prepared?.ok || prepared.environment!=='sandbox' ||
    prepared.apiOrigin!=='https://sandbox-api.paddle.com' ||
    !response || !TXN.test(response.id||'') ||
    !['draft','ready'].includes(response.status) ||
    response.collection_mode!=='automatic' ||
    !Array.isArray(response.items) || response.items.length!==1 ||
    response.items[0]?.price?.id!==prepared.expected.priceId ||
    response.items[0]?.quantity!==1 ||
    response.custom_data?.epmo_intent_id!==prepared.expected.intentId ||
    response.custom_data?.epmo_attempt_id!==prepared.expected.attemptId ||
    response.custom_data?.epmo_invoice_id!==prepared.expected.invoiceId ||
    response.custom_data?.epmo_tenant_id!==prepared.expected.tenantId)
    return fail('response_not_bound_to_server_intent');
 // This returns a candidate ONLY. Caller must insert one immutable row
 // matching the tenant, plan and Paddle transaction ID under an SQL lock.
 return {ok:true,transactionId:response.id,
   intentId:prepared.expected.intentId,
   requiresAtomicTenantPersistence:true,
   collectionEnabled:false,entitlementGranted:false};
}
