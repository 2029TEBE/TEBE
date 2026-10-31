import { readBoundedSuccessJson } from './bounded-success-json.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** HTTP 200 (including an HTML login page) is not a billing acknowledgement. */
export async function readBillingMutationJson(response) {
  if (!response?.ok || response.redirected ||
      !/^application\/json(?:\s*;|\s*$)/i.test(response.headers?.get('content-type') ?? '')) return null;
  try {
    const value = await readBoundedSuccessJson(response, 16_384);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** Tenant-scoped API contract; paymentVerified:false is NOT a payment receipt. */
export function isRenewalInvoiceAcknowledged(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    typeof value.invoiceId === 'string' && UUID.test(value.invoiceId) &&
    (value.status === 'open' || value.status === 'paid') &&
    value.paymentVerified === false &&
    Number.isSafeInteger(value.amountMinor) && value.amountMinor > 0 &&
    typeof value.currency === 'string' && /^[A-Z]{3}$/.test(value.currency);
}

/** Reject a mismatched cancellation/resumption acknowledgement. */
export function isSubscriptionPreferenceAcknowledged(value, cancel) {
  return typeof cancel === 'boolean' && !!value && typeof value === 'object' &&
    !Array.isArray(value) && typeof value.id === 'string' && UUID.test(value.id) &&
    value.cancelAtPeriodEnd === cancel &&
    (value.unchanged === undefined || typeof value.unchanged === 'boolean');
}
