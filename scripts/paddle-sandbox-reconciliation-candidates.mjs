/**
 * Offline Paddle Sandbox transaction-candidate audit for a lost create response.
 * A provider search result is not authentication, ownership or completeness proof.
 * No API requests, automatic POST retries, customer checkout, payments or grants.
 */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TXN=/^txn_[a-z0-9]{26}$/;
const PRICE='pri_01m6x7w5zy16nktzjwg2ezas2d';
const deny=(reason)=>Object.freeze({ok:false,reason,action:'manual_reconciliation_required',
  candidateTransactionId:null,canRetryCreate:false,checkoutAllowed:false,
  entitlementGranted:false,providerVerified:false});

export function inspectSandboxRecoveryCandidates(committed,listing,{
  deploymentEnv,paddleEnv,paddleEnabled,billingProvider
}={}) {
 if(!['development','staging'].includes(deploymentEnv) ||
    paddleEnv!=='sandbox'||paddleEnabled!=='false'||billingProvider!=='paddle')
   return deny('billing_environment_disabled');
 if(!committed||committed.source!=='committed-tenant-sql'||
    committed.environment!=='sandbox'||
    ![committed.id,committed.attemptId,committed.tenantId,committed.invoiceId]
      .every(x=>typeof x==='string'&&UUID.test(x))||
    committed.paddlePriceId!==PRICE||
    committed.amountMinor!==4900||committed.currency!=='USD'||
    !['creating','reconciliation_required'].includes(committed.status))
   return deny('untrusted_committed_attempt');

 // This function intentionally CANNOT accept paginated or partial results
 // as evidence of uniqueness. The caller must independently establish provider
 // API authentication, exact search scope and exhaustion before any binding.
 if(!listing||listing.environment!=='sandbox'||listing.source!=='server-provider-list-read'||
    listing.allPagesExhausted!==true||listing.filtersVerified!==true||
    !Array.isArray(listing.transactions)||
    listing.transactions.length>10000)
   return deny('provider_listing_incomplete_or_unverified');

 const ids=new Set();
 for(const item of listing.transactions) {
   if(!item||typeof item!=='object'||!TXN.test(item.id||'')||
      ids.has(item.id)) return deny('invalid_or_duplicate_provider_transaction');
   ids.add(item.id);
 }
 const match=listing.transactions.filter(item=>
   item.custom_data?.epmo_intent_id===committed.id);
 if(match.length!==1) return deny(match.length>1
   ? 'multiple_provider_transactions_for_intent'
   : 'no_provider_transaction_for_intent');

 const candidate=match[0];
 if(candidate.collection_mode!=='automatic'||
   !['draft','ready'].includes(candidate.status)||
   candidate.currency_code!=='USD'||
   !Array.isArray(candidate.items)||candidate.items.length!==1||
   candidate.items[0]?.price?.id!==PRICE||candidate.items[0]?.quantity!==1||
   candidate.custom_data?.epmo_attempt_id!==committed.attemptId||
   candidate.custom_data?.epmo_invoice_id!==committed.invoiceId||
   candidate.custom_data?.epmo_tenant_id!==committed.tenantId)
   return deny('candidate_terms_or_tenant_mismatch');

 // Identification is not an authorization to persist. That needs independent
 // provider authentication, price and invoice validation, and tenant SQL locks.
 return Object.freeze({ok:true,reason:'candidate_identified_needs_independent_validation',
   action:'review_candidate_without_persistence',candidateTransactionId:candidate.id,
   canRetryCreate:false,checkoutAllowed:false,entitlementGranted:false,providerVerified:false});
}
