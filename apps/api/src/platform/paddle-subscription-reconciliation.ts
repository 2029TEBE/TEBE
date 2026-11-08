/**
 * Backend-only, non-authorizing Paddle subscription reconciliation preflight.
 *
 * This function checks data consistency, NOT the authenticity of an API fetch.
 * Its caller must independently fetch the provider record with server-held
 * sandbox credentials and prove the response comes from Paddle. Never use the
 * returned value as permission to mark invoices paid or grant entitlements.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TXN=/^txn_[a-z0-9]{26}$/;
const SUB=/^sub_[a-z0-9]{26}$/;
const CUSTOMER=/^ctm_[a-z0-9]{26}$/;
const PRICE='pri_01m6x7w5zy16nktzjwg2ezas2d';

type TrustedBinding={
  source:'locked-tenant-database'; tenantId:string; invoiceId:string;
  subscriptionId:string; transactionId:string; priceId:string;
  /** Must be persisted and retrieved under the locked tenant context; do not infer from event metadata. */
  paddleCustomerId:string;
  amountMinor:number; currency:string; environment:'sandbox';
};
type SignedNotice={
  transactionId:string; paddleSubscriptionId:string;
  tenantId:string; invoiceId:string; priceId:string;
  amountMinor:number; currency:string;
};
type ProviderRead={
  // Only a trusted caller can establish the origin of this response.
  source:'authenticated-paddle-sandbox-get'; transactionId:string;
  subscriptionId:string; customerId:string; priceId:string; status:'completed';
  amountMinor:number; currency:string;
};
type Input={trusted:TrustedBinding; signed:SignedNotice; provider:ProviderRead};
type Result={consistent:boolean; reason:string; invoiceMarkedPaid:false; entitlementGranted:false};

export function assessPaddleSubscriptionReconciliation(input:Input):Result {
  const deny=(reason:string):Result=>({
    consistent:false,reason,invoiceMarkedPaid:false,entitlementGranted:false
  });
  if(!input?.trusted||!input.signed||!input.provider)
    return deny('missing_independent_evidence');
  const {trusted:t,signed:s,provider:p}=input;
  if(t.source!=='locked-tenant-database'||t.environment!=='sandbox'||
     p.source!=='authenticated-paddle-sandbox-get'||
     !UUID.test(t.tenantId)||!UUID.test(t.invoiceId)||!UUID.test(t.subscriptionId)||
     !TXN.test(t.transactionId)||!TXN.test(s.transactionId)||!TXN.test(p.transactionId)||
     !SUB.test(s.paddleSubscriptionId)||!SUB.test(p.subscriptionId)||
     !CUSTOMER.test(t.paddleCustomerId)||!CUSTOMER.test(p.customerId))
    return deny('invalid_evidence_provenance_or_identifiers');
  if(t.priceId!==PRICE||t.amountMinor!==4900||t.currency!=='USD'||
     s.priceId!==PRICE||s.amountMinor!==4900||s.currency!=='USD'||
     p.priceId!==PRICE||p.amountMinor!==4900||p.currency!=='USD'||
     p.status!=='completed')
    return deny('unverified_price_amount_currency_or_status');
  if(t.tenantId!==s.tenantId||t.invoiceId!==s.invoiceId||
     t.transactionId!==s.transactionId||t.transactionId!==p.transactionId||
     s.paddleSubscriptionId!==p.subscriptionId||
     t.paddleCustomerId!==p.customerId)
    return deny('provider_subscription_or_tenant_binding_mismatch');
  return {consistent:true,reason:'consistent_only_not_payment_authorization',
    invoiceMarkedPaid:false,entitlementGranted:false};
}
