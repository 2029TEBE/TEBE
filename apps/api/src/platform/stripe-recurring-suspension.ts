/**
 * C39: signed Stripe TEST subscription paused/unpaid lifecycle boundary.
 * The signed snapshot is only a candidate; caller independently GETs Stripe
 * Subscription and reconciles a tenant binding under advisory/row locks.
 * This module never grants or extends a paid entitlement.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id = (prefix: string, value: unknown): value is string =>
  typeof value === 'string' && new RegExp('^' + prefix + '[A-Za-z0-9]+$').test(value);
const ref = (value: any): string | null =>
  typeof value === 'string' ? value :
  value && typeof value === 'object' && typeof value.id === 'string' ? value.id : null;

export type RecurringSuspensionCandidate = Readonly<{
  eventId: string; tenantId: string; planId: string;
  stripeSubscriptionId: string; stripeCustomerId: string;
  providerStatus: 'paused' | 'unpaid';
}>;
export type RecurringSuspensionLedger = Readonly<{
  tenantId: string; subscriptionId: string; planId: string;
  stripeSubscriptionId: string; stripeCustomerId: string;
  stripePriceId: string; bindingStatus: string;
  localStatus: string; localPeriodEndsAt: string | Date;
}>;

/** Only invoke after Stripe-Signature HMAC verification. */
export function parseRecurringSuspension(rawBody: Buffer, liveMode: boolean):
  RecurringSuspensionCandidate | null {
  let event: any;
  try { event = JSON.parse(rawBody.toString('utf8')); }
  catch { throw new Error('Invalid signed recurring suspension JSON'); }
  if (event?.type !== 'customer.subscription.paused' &&
      event?.type !== 'customer.subscription.updated') return null;
  const sub = event?.data?.object;
  if (event.type === 'customer.subscription.updated' &&
      sub?.status !== 'paused' && sub?.status !== 'unpaid') return null;
  if (liveMode || !id('evt_', event.id) || event.livemode !== false ||
      !sub || sub.object !== 'subscription' || sub.livemode !== false ||
      !id('sub_', sub.id) || !id('cus_', ref(sub.customer)) ||
      !UUID.test(sub.metadata?.tenantId ?? '') ||
      !UUID.test(sub.metadata?.planId ?? '') ||
      !['paused', 'unpaid'].includes(sub.status) ||
      (event.type === 'customer.subscription.paused' && sub.status !== 'paused'))
    throw new Error('Invalid signed TEST recurring suspension identity');
  return Object.freeze({
    eventId: event.id, tenantId: sub.metadata.tenantId,
    planId: sub.metadata.planId, stripeSubscriptionId: sub.id,
    stripeCustomerId: ref(sub.customer)!, providerStatus: sub.status,
  });
}

export function assertRecurringSuspensionProvider(
  candidate: RecurringSuspensionCandidate, providerValue: unknown,
  ledger: RecurringSuspensionLedger, latestSubscriptionId: string,
  liveMode: boolean,
): void {
  const provider = providerValue as any;
  if (liveMode || !candidate || !ledger || !provider ||
      !UUID.test(ledger.tenantId) || !UUID.test(ledger.subscriptionId) ||
      !UUID.test(ledger.planId) ||
      candidate.tenantId !== ledger.tenantId ||
      candidate.planId !== ledger.planId ||
      candidate.stripeSubscriptionId !== ledger.stripeSubscriptionId ||
      candidate.stripeCustomerId !== ledger.stripeCustomerId ||
      latestSubscriptionId !== ledger.subscriptionId ||
      !id('price_', ledger.stripePriceId) ||
      !['pending', 'active'].includes(ledger.bindingStatus) ||
      !['trialing', 'active', 'past_due', 'paused'].includes(ledger.localStatus) ||
      provider.object !== 'subscription' || provider.livemode !== false ||
      provider.id !== candidate.stripeSubscriptionId ||
      ref(provider.customer) !== ledger.stripeCustomerId ||
      provider.status !== candidate.providerStatus ||
      provider.metadata?.tenantId !== ledger.tenantId ||
      provider.metadata?.planId !== ledger.planId)
    throw new Error('Recurring suspension is not owned by the current tenant');
  const items = provider.items;
  if (!Array.isArray(items?.data) || items.data.length !== 1 ||
      (items.has_more !== undefined && items.has_more !== false) ||
      (items.total_count !== undefined && items.total_count !== 1) ||
      ref(items.data[0]?.price) !== ledger.stripePriceId ||
      items.data[0]?.quantity !== 1)
    throw new Error('Recurring suspension price list is incomplete or changed');
  if (!Number.isFinite(new Date(ledger.localPeriodEndsAt).getTime()))
    throw new Error('Invalid existing recurring entitlement period');
}

/** Stripe paused revokes now; unpaid preserves already-paid access until expiry. */
export function recurringSuspensionTransition(
  candidate: RecurringSuspensionCandidate,
  ledger: RecurringSuspensionLedger,
  now: number = Date.now(),
): 'paused' | 'past_due' | null {
  if (!candidate || !ledger || !Number.isFinite(now) ||
      candidate.tenantId !== ledger.tenantId ||
      candidate.stripeSubscriptionId !== ledger.stripeSubscriptionId ||
      !['trialing', 'active', 'past_due', 'paused'].includes(ledger.localStatus))
    throw new Error('Untrusted recurring suspension transition');
  const end = new Date(ledger.localPeriodEndsAt).getTime();
  if (!Number.isFinite(end)) throw new Error('Invalid recurring paid-period end');
  if (candidate.providerStatus === 'paused')
    return ledger.localStatus === 'paused' ? null : 'paused';
  if (candidate.providerStatus === 'unpaid')
    return end <= now && ['trialing', 'active'].includes(ledger.localStatus) ?
      'past_due' : null;
  throw new Error('Unknown recurring suspension status');
}
