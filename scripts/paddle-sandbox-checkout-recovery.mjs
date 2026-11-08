/**
 * Offline-only decision policy after an ambiguous Paddle Sandbox POST.
 * A failed/timeout create response cannot prove that no transaction exists.
 * Therefore NEVER retry POST /transactions automatically and never issue a
 * second checkout for the same server-owned intent.
 *
 * This pure function takes only server-authoritative metadata. It does not
 * query Paddle, access a database or activate payments.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TXN=/^txn_[a-z0-9]{26}$/;
const PRICE='pri_01m6x7w5zy16nktzjwg2ezas2d';
const deny=reason=>Object.freeze({ok:false,reason,canRetryCreate:false,
 checkoutAllowed:false,entitlementGranted:false});

export function decideSandboxCheckoutRecovery(intent, providerEvidence, {
  deploymentEnv, paddleEnv, paddleEnabled, billingProvider
}={}) {
  if(!['development','staging'].includes(deploymentEnv) ||
     paddleEnv!=='sandbox'||paddleEnabled!=='false'||billingProvider!=='paddle')
    return deny('billing_environment_disabled');

  if(!intent||intent.source!=='committed-tenant-sql' ||
     intent.environment!=='sandbox' ||
     !UUID.test(intent.id||'') || !UUID.test(intent.tenantId||'') ||
     !UUID.test(intent.invoiceId||'') ||
     intent.paddlePriceId!==PRICE ||
     !['creating','reconciliation_required','bound'].includes(intent.status))
    return deny('untrusted_checkout_intent');

  if(intent.status==='bound'){
    if(!TXN.test(intent.transactionId||''))
      return deny('invalid_bound_transaction');
    return Object.freeze({ok:true,action:'read_existing_binding',
      transactionId:intent.transactionId,canRetryCreate:false,
      checkoutAllowed:false,entitlementGranted:false});
  }

  // A lost response, a provider-side 5xx and a client timeout ALL mean that
  // the transaction may already have been created. No automatic POST retry.
  if(!providerEvidence || providerEvidence.source!=='trusted-server-reconciliation' ||
     providerEvidence.environment!=='sandbox' ||
     providerEvidence.intentId!==intent.id ||
     providerEvidence.tenantId!==intent.tenantId ||
     providerEvidence.invoiceId!==intent.invoiceId ||
     providerEvidence.priceId!==PRICE)
    return Object.freeze({ok:true,action:'manual_reconciliation_required',
      canRetryCreate:false,checkoutAllowed:false,entitlementGranted:false});

  if(providerEvidence.foundExactlyOne===true &&
     TXN.test(providerEvidence.transactionId||'') &&
     providerEvidence.collectionMode==='automatic' &&
     ['draft','ready'].includes(providerEvidence.status) &&
     providerEvidence.quantity===1)
    return Object.freeze({ok:true,action:'persist_reconciled_transaction',
      transactionId:providerEvidence.transactionId,canRetryCreate:false,
      checkoutAllowed:false,entitlementGranted:false});

  return Object.freeze({ok:true,action:'manual_reconciliation_required',
    canRetryCreate:false,checkoutAllowed:false,entitlementGranted:false});
}
