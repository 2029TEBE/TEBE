/** One fail-closed authorization boundary for Paddle subscription notifications.
 *
 * This function does not access the database or enable paid features. The
 * caller MUST load the unique, immutable server-owned Paddle subscription
 * binding, then atomically store the event ID, timestamp and entitlement
 * in a tenant-scoped transaction. A missing binding must never be synthesized
 * from webhook custom_data or browser-originated tenant identifiers.
 */
import { authenticatePaddleWebhook } from './paddle-signature.ts';
import {
  readPaddleSubscriptionEvent,
  decidePaddleSubscriptionUpdate,
  paddleAccessAllowed,
} from './paddle-subscription-policy.ts';

export function evaluateSignedPaddleSubscription(
  rawBody,
  signatureHeader,
  notificationSecret,
  binding,
  nowMs = Date.now(),
) {
  const verified = authenticatePaddleWebhook(rawBody, signatureHeader, notificationSecret, nowMs);
  const event = readPaddleSubscriptionEvent(verified);
  if (event === null) return { action: 'ignore', eventId: verified.eventId };
  // The authenticated notification does NOT prove tenant ownership.
  // The binding must come from durable, server-owned transaction records.
  if (!binding) throw new Error('Missing server-owned Paddle subscription binding');
  const action = decidePaddleSubscriptionUpdate(event, binding);
  return {
    action,
    tenantId: binding.tenantId,
    providerSubscriptionId: binding.providerSubscriptionId,
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    subscriptionStatus: event.status,
    allowAccess: action === 'apply' ? paddleAccessAllowed(event.status) : null,
    priceIds: event.priceIds,
    productIds: event.productIds,
  };
}
