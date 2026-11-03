/**
 * Paddle sandbox settlement preflight. No network, database, or entitlement writes.
 * A verified signature alone is never evidence of a paid tenant subscription.
 * Call only after raw-body signature verification and within a tenant-scoped,
 * serializable database transaction using a server-created checkout intent.
 */
const ID = {
  event: /^evt_[a-z0-9]{20,}$/,
  transaction: /^txn_[a-z0-9]+$/,
  subscription: /^sub_[a-z0-9]+$/,
  price: /^pri_[a-z0-9]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
};
const fail = reason => ({ accepted: false, reason });

/**
 * Trusted intent must originate from a locked database row, not webhook custom_data.
 * The provider event must already have passed Paddle-Signature verification.
 */
export function evaluatePaddleSandboxSettlement(event, intent, { signatureVerified = false, now = Date.now() } = {}) {
  if (!signatureVerified) return fail('signature_not_verified');
  if (!event || event.event_type !== 'transaction.completed' || !ID.event.test(event.event_id || ''))
    return fail('not_completed_transaction');
  const data = event.data;
  if (!data || !ID.transaction.test(data.id || '') || data.status !== 'completed')
    return fail('transaction_not_completed');
  if (!intent || intent.environment !== 'sandbox' || intent.provider !== 'paddle' ||
      !ID.uuid.test(intent.tenantId || '') || !ID.uuid.test(intent.subscriptionId || '') ||
      !ID.transaction.test(intent.transactionId || '') || !ID.price.test(intent.priceId || ''))
    return fail('untrusted_intent');
  if (data.id !== intent.transactionId) return fail('transaction_mismatch');
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(intent.expiresAt) || now > intent.expiresAt)
    return fail('intent_expired');
  if (!ID.subscription.test(data.subscription_id || '')) return fail('missing_provider_subscription');
  if (typeof intent.subscriptionProviderId === 'string' &&
      data.subscription_id !== intent.subscriptionProviderId)
    return fail('subscription_mismatch');
  const items = data.details?.line_items;
  if (!Array.isArray(items) || items.length !== 1 || items[0]?.price?.id !== intent.priceId ||
      !Number.isSafeInteger(items[0]?.quantity) || items[0].quantity !== 1)
    return fail('price_or_quantity_mismatch');
  const total = data.details?.totals?.grand_total;
  const currency = data.currency_code;
  if (!Number.isSafeInteger(intent.amountMinor) || intent.amountMinor <= 0 ||
      typeof total !== 'string' || !/^(0|[1-9][0-9]*)$/.test(total) ||
      Number(total) !== intent.amountMinor || currency !== intent.currency)
    return fail('amount_or_currency_mismatch');
  if (data.custom_data?.tenantId && data.custom_data.tenantId !== intent.tenantId)
    return fail('tenant_mismatch');
  return {
    accepted: true, eventId: event.event_id, transactionId: data.id,
    providerSubscriptionId: data.subscription_id, tenantId: intent.tenantId,
    subscriptionId: intent.subscriptionId, amountMinor: intent.amountMinor,
    currency: intent.currency,
    // Not a grant: caller must atomically insert receipt + settlement and
    // verify provider ownership/transaction freshness before entitlement change.
    requiresAtomicPersistence: true,
  };
}
