/** A recurring Checkout redirect is TEST-only navigation, never a payment receipt.
 * The server binds the session to the tenant's immutable subscription ledger.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function stripeRecurringCheckoutRedirect(payload, now = Date.now()) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      payload.recurring !== true || payload.paymentVerified !== false ||
      !UUID.test(payload.subscriptionId ?? '') || !UUID.test(payload.planId ?? '') ||
      typeof payload.sessionId !== 'string' ||
      !/^cs_test_[A-Za-z0-9]+$/.test(payload.sessionId) ||
      typeof payload.url !== 'string' || payload.url.length > 8192 ||
      typeof payload.expiresAt !== 'string' ||
      !Number.isFinite(now))
    return null;
  const expiry = Date.parse(payload.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 86_400_000) return null;
  try {
    const url = new URL(payload.url);
    if (url.origin !== 'https://checkout.stripe.com' ||
        url.username || url.password || url.port ||
        (url.pathname !== '/c/pay/' + payload.sessionId &&
         url.pathname !== '/pay/' + payload.sessionId))
      return null;
    return url;
  } catch {
    return null;
  }
}
