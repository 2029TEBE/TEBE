/**
 * Offline acceptance for the LAST step before a provider checkout URL can be
 * exposed: an immutable, tenant-owned SQL checkout-intent record must match
 * the provider transaction. This function does not access SQL or Paddle.
 * It must be supplied with a row read back from a committed tenant transaction.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TXN=/^txn_[a-z0-9]{26}$/;
const PRICE='pri_01m6x7w5zy16nktzjwg2ezas2d';
const fail=reason=>({ok:false,reason,checkoutAllowed:false,entitlementGranted:false});

export function verifyPersistedSandboxCheckout(prepared, candidate, persisted, {now=Date.now()}={}) {
  if (!Number.isSafeInteger(now) || !prepared?.ok || prepared.environment!=='sandbox' ||
      prepared.collectionEnabled!==false || prepared.entitlementGranted!==false ||
      prepared.expected?.priceId!==PRICE || prepared.expected?.amountMinor!==4900 ||
      prepared.expected?.currency!=='USD' ||
      !candidate?.ok || candidate.requiresAtomicTenantPersistence!==true ||
      candidate.collectionEnabled!==false || candidate.entitlementGranted!==false ||
      !TXN.test(candidate.transactionId||'') ||
      candidate.intentId!==prepared.expected.intentId)
    return fail('untrusted_checkout_candidate');

  if (!persisted || persisted.source!=='committed-tenant-sql' ||
      persisted.environment!=='sandbox' ||
      ![persisted.tenantId,persisted.intentId,persisted.attemptId,persisted.invoiceId,persisted.subscriptionId,
        persisted.planId].every(x=>typeof x==='string'&&UUID.test(x)) ||
      !UUID.test(prepared.expected.tenantId||'') ||
      !UUID.test(prepared.expected.attemptId||'') ||
      !UUID.test(prepared.expected.invoiceId||'') ||
      persisted.tenantId!==prepared.expected.tenantId ||
      persisted.intentId!==prepared.expected.intentId ||
      persisted.attemptId!==prepared.expected.attemptId ||
      persisted.invoiceId!==prepared.expected.invoiceId ||
      persisted.subscriptionId!==prepared.expected.subscriptionId ||
      persisted.planId!==prepared.expected.planId ||
      persisted.paddleTransactionId!==candidate.transactionId ||
      persisted.paddlePriceId!==PRICE ||
      persisted.invoiceStatus!=='open' ||
      persisted.invoiceAmountMinor!==4900 ||
      persisted.invoiceCurrency!=='USD' ||
      !Number.isSafeInteger(persisted.expiresAt) ||
      persisted.expiresAt!==prepared.expected.expiresAt ||
      persisted.expiresAt<=now)
    return fail('uncommitted_or_mismatched_checkout_intent');
  return Object.freeze({
    ok:true, persisted:true, sandboxOnly:true,
    transactionId:candidate.transactionId,
    intentId:candidate.intentId,
    requiresAuthenticatedCheckoutRoute:true,
    checkoutAllowed:false,
    entitlementGranted:false
  });
}
