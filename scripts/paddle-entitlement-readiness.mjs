/**
 * Read-only Paddle entitlement and invoice activation preflight.
 * This is a candidate decision, NEVER a DB writer or access grant.
 * Trust only values loaded from locked, tenant-scoped database records.
 */
const deny=(reason)=>({eligible:false,reason,grantEntitlement:false,markInvoicePaid:false});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const paidExceptionActions=new Set(['refund','credit','chargeback','chargeback_warning']);
export function reviewPaddleInvoiceActivation(input) {
 const {invoice,settlement,subscription,receipt,adjustments,merchantReconciled,
   source,latestSubscriptionId}=input||{};
 if(source!=='locked-tenant-postgres' || !invoice || !settlement || !subscription || !receipt)
   return deny('untrusted_financial_source');
 if(!uuid.test(invoice.tenantId||'') || !uuid.test(invoice.id||'') ||
    !uuid.test(subscription.id||'') || !uuid.test(settlement.id||'') ||
    !uuid.test(receipt.id||'')) return deny('invalid_ids');
 if(invoice.tenantId!==settlement.tenantId ||
    invoice.tenantId!==subscription.tenantId || invoice.tenantId!==receipt.tenantId ||
    settlement.invoiceId!==invoice.id ||
    settlement.subscriptionId!==subscription.id ||
    invoice.subscriptionId!==subscription.id ||
    receipt.checkoutIntentId!==settlement.checkoutIntentId ||
    receipt.id!==settlement.receiptId ||
    receipt.paddleTransactionId!==settlement.paddleTransactionId)
   return deny('cross_tenant_or_binding_mismatch');
 if(latestSubscriptionId!==subscription.id ||
    !['active','trialing','past_due'].includes(subscription.status) ||
    subscription.cancelAtPeriodEnd || invoice.status!=='open')
   return deny('subscription_not_eligible');
 if(!Number.isSafeInteger(invoice.amountMinor) || invoice.amountMinor<=0 ||
    settlement.amountMinor!==invoice.amountMinor ||
    invoice.currency!==settlement.currency)
   return deny('money_mismatch');
 if(!Number.isFinite(Date.parse(invoice.periodStartsAt)) ||
    !Number.isFinite(Date.parse(invoice.periodEndsAt)) ||
    Date.parse(invoice.periodEndsAt)<=Date.parse(invoice.periodStartsAt) ||
    Date.parse(invoice.periodStartsAt)!==Date.parse(subscription.periodEndsAt))
   return deny('period_mismatch');
 if(!Array.isArray(adjustments))
   return deny('adjustment_history_not_reconciled');
 if(adjustments.some(x=>!x || x.paddleTransactionId!==settlement.paddleTransactionId))
   return deny('foreign_adjustment');
 if(adjustments.some(x=>paidExceptionActions.has(x.action) &&
    x.status!=='rejected' && x.status!=='reversed'))
   return deny('refund_or_dispute_requires_manual_review');
 if(merchantReconciled!==true)
   return deny('merchant_api_confirmation_outstanding');
 // A later independently reviewed service must require explicit signed
 // settlement, Paddle API reconciliation and DB locks before any state update.
 return {eligible:true,reason:'candidate_only',grantEntitlement:false,markInvoicePaid:false};
}
