/**
 * C41: classify signed recurring Stripe lifecycle events that currently have
 * no tenant-locked reconciliation path. A 2xx "ignored" response would lose
 * the provider retry while a subscription may require access reconciliation.
 *
 * Call ONLY after raw-body Stripe-Signature verification. This function never
 * selects a tenant, mutates an entitlement, or accepts webhook metadata as
 * authorization. Non-recurring one-time invoice events remain unaffected.
 */
const UNSUPPORTED_RECURRING_INVOICES = new Set([
  'invoice.voided',
  'invoice.marked_uncollectible',
  'invoice.finalization_failed',
  'invoice.payment_action_required',
]);

export function requiresRecurringLifecycleReconciliation(value: unknown): boolean {
  const event = value as any;
  if (!event || typeof event !== 'object') return false;
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data?.object;
    // A malformed signed subscription update is not safe to acknowledge.
    if (!subscription || subscription.object !== 'subscription') return true;
    // Paused/unpaid/past_due, cancellation and resumption are reconciled earlier in
    // the webhook. An unhandled terminal/incomplete update is NOT success.
    return ['incomplete', 'incomplete_expired', 'canceled']
      .includes(subscription.status);
  }
  if (!UNSUPPORTED_RECURRING_INVOICES.has(event.type)) return false;
  const invoice = event.data?.object;
  // A malformed terminal invoice cannot safely be classified as one-time.
  if (!invoice || invoice.object !== 'invoice') return true;
  return invoice.subscription != null ||
    invoice.parent?.subscription_details?.subscription != null ||
    (typeof invoice.billing_reason === 'string' &&
     invoice.billing_reason.startsWith('subscription_'));
}
