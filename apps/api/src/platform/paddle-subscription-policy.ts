/** Pure Paddle subscription entitlement boundary.
 * Database persistence, checkout ownership and webhook delivery handling are
 * intentionally separate. Never trust unverified client-provided tenant IDs.
 */
export type PaddleSubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled';
export type PaddleSubscriptionEvent = {
  eventId: string;
  eventType: 'subscription.created' | 'subscription.updated';
  occurredAt: string;
  providerSubscriptionId: string;
  providerCustomerId: string;
  status: PaddleSubscriptionStatus;
  priceIds: string[];
  productIds: string[];
};

export type BoundPaddleSubscription = {
  tenantId: string;
  providerSubscriptionId: string;
  providerCustomerId: string;
  lastEventId: string | null;
  lastEventAt: string | null;
};

const PADDLE_SUB = /^sub_[a-z0-9]{26}$/;
const PADDLE_CUSTOMER = /^ctm_[a-z0-9]{26}$/;
const PADDLE_PRODUCT = /^pro_[a-z0-9]{26}$/;
const PADDLE_PRICE = /^pri_[a-z0-9]{26}$/;
const EVENT = /^evt_[a-z0-9]{26}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const statuses = new Set<PaddleSubscriptionStatus>(['trialing', 'active', 'past_due', 'paused', 'canceled']);

function validIso(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value));
}

/** Interpret only the two subscription mirror events, after authenticating the raw webhook.
 * Unknown event types do not change access, and do not acknowledge provisioning.
 */
export function readPaddleSubscriptionEvent(input: {
  eventId: string; eventType: string; occurredAt: string; data: Record<string, unknown>;
}): PaddleSubscriptionEvent | null {
  if (input.eventType !== 'subscription.created' && input.eventType !== 'subscription.updated')
    return null;
  if (!EVENT.test(input.eventId) || !validIso(input.occurredAt))
    throw new Error('Invalid Paddle event identity or time');
  const data = input.data;
  if (!data || typeof data !== 'object' ||
      typeof data.id !== 'string' || !PADDLE_SUB.test(data.id) ||
      typeof data.customer_id !== 'string' || !PADDLE_CUSTOMER.test(data.customer_id) ||
      typeof data.status !== 'string' || !statuses.has(data.status as PaddleSubscriptionStatus) ||
      !Array.isArray(data.items) || data.items.length === 0 || data.items.length > 100)
    throw new Error('Invalid Paddle subscription');
  const items = data.items as unknown[];
  const priceIds: string[] = [];
  const productIds: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      throw new Error('Invalid subscription item');
    const price = (item as Record<string, unknown>).price;
    if (!price || typeof price !== 'object' || Array.isArray(price))
      throw new Error('Invalid item price');
    const { id, product_id } = price as Record<string, unknown>;
    if (typeof id !== 'string' || !PADDLE_PRICE.test(id) ||
        typeof product_id !== 'string' || !PADDLE_PRODUCT.test(product_id))
      throw new Error('Invalid item price/product');
    priceIds.push(id); productIds.push(product_id);
  }
  return {
    eventId: input.eventId, eventType: input.eventType,
    occurredAt: input.occurredAt, providerSubscriptionId: data.id,
    providerCustomerId: data.customer_id,
    status: data.status as PaddleSubscriptionStatus,
    priceIds: [...new Set(priceIds)], productIds: [...new Set(productIds)],
  };
}

/** Fail closed: a signed provider event must resolve to an EXISTING, server-bound
 * tenant + subscription + customer. No new tenant is created from custom_data.
 * Persistence must atomically deduplicate event IDs and compare timestamps.
 */
export function decidePaddleSubscriptionUpdate(event: PaddleSubscriptionEvent,
  binding: BoundPaddleSubscription): 'apply' | 'duplicate' | 'stale' {
  if (!UUID.test(binding.tenantId) ||
      event.providerSubscriptionId !== binding.providerSubscriptionId ||
      event.providerCustomerId !== binding.providerCustomerId)
    throw new Error('Paddle event does not match the server-owned tenant binding');
  if (event.eventId === binding.lastEventId) return 'duplicate';
  if (binding.lastEventAt !== null) {
    if (!validIso(binding.lastEventAt))
      throw new Error('Stored Paddle ordering state is invalid');
    // Equal timestamps with distinct IDs are ambiguous, so force reconciliation.
    if (Date.parse(event.occurredAt) === Date.parse(binding.lastEventAt))
      throw new Error('Ambiguous Paddle event ordering; reconciliation required');
    if (Date.parse(event.occurredAt) < Date.parse(binding.lastEventAt)) return 'stale';
  }
  return 'apply';
}

/** Access is determined by a verified, reconciled subscription state and
 * explicit product/price entitlement mapping, not a checkout redirect.
 */
export function paddleAccessAllowed(status: PaddleSubscriptionStatus): boolean {
  // Match the existing ModuleGuard until a reviewed grace-period policy is implemented.
  // Do not accidentally widen access for a past-due tenant via a new provider.
  return status === 'active' || status === 'trialing';
}
