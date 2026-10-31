/**
 * C36: signed Stripe TEST cancellation-resumption verification.
 * A subscription.updated event can clear a scheduled cancellation only when
 * the independent provider GET, immutable paid period, and current tenant
 * ledger all agree. Never activate, extend, or unpause an entitlement here.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id = (prefix: string, value: unknown): value is string =>
  typeof value === 'string' && new RegExp('^' + prefix + '[A-Za-z0-9]+$').test(value);
const ref = (value: any): string | null =>
  typeof value === 'string' ? value :
  value && typeof value === 'object' && typeof value.id === 'string' ? value.id : null;

export type RecurringResumptionCandidate = Readonly<{
  eventId: string; stripeSubscriptionId: string; customerId: string;
  tenantId: string; planId: string;
}>;

export type RecurringResumptionLedger = Readonly<{
  tenantId: string; subscriptionId: string; planId: string;
  stripeSubscriptionId: string; stripeCustomerId: string; stripePriceId: string;
  bindingStatus: string; bindingCancelAtPeriodEnd: boolean;
  bindingLastPeriodEndsAt: string | Date | null;
  localStatus: string; localCancelAtPeriodEnd: boolean;
  localPeriodEndsAt: string | Date;
  settledStripeInvoiceId: string; settledInvoiceStatus: string;
  settledPeriodEndsAt: string | Date;
  hasBlockingReversal: boolean;
}>;

/** Must be called only after raw-body Stripe HMAC verification. */
export function parseRecurringResumption(raw: Buffer, liveMode: boolean):
  RecurringResumptionCandidate | null {
  let event: any;
  try { event = JSON.parse(raw.toString('utf8')); }
  catch { throw new Error('Invalid signed recurring resumption JSON'); }
  if (event?.type !== 'customer.subscription.updated') return null;
  const sub = event?.data?.object;
  // Ordinary subscription updates are not authorization to undo cancellation.
  if (sub?.cancel_at_period_end !== false ||
      event?.data?.previous_attributes?.cancel_at_period_end !== true) return null;
  if (liveMode || !id('evt_', event.id) || event.livemode !== false ||
      !sub || sub.object !== 'subscription' || sub.livemode !== false ||
      !id('sub_', sub.id) || !id('cus_', ref(sub.customer)) ||
      sub.status !== 'active' ||
      !UUID.test(sub.metadata?.tenantId ?? '') ||
      !UUID.test(sub.metadata?.planId ?? ''))
    throw new Error('Invalid signed TEST recurring resumption identity');
  return Object.freeze({
    eventId: event.id, stripeSubscriptionId: sub.id,
    customerId: ref(sub.customer)!, tenantId: sub.metadata.tenantId,
    planId: sub.metadata.planId,
  });
}

export function assertRecurringResumptionProvider(
  candidate: RecurringResumptionCandidate, provider: unknown,
  ledger: RecurringResumptionLedger, latestSubscriptionId: string,
  liveMode: boolean, now: number = Date.now(),
): void {
  const sub = provider as any;
  if (liveMode || !candidate || !ledger || !sub ||
      !UUID.test(ledger.tenantId) || !UUID.test(ledger.subscriptionId) ||
      !UUID.test(ledger.planId) ||
      candidate.tenantId !== ledger.tenantId ||
      candidate.planId !== ledger.planId ||
      candidate.stripeSubscriptionId !== ledger.stripeSubscriptionId ||
      candidate.customerId !== ledger.stripeCustomerId ||
      latestSubscriptionId !== ledger.subscriptionId ||
      !id('price_', ledger.stripePriceId) ||
      !id('in_', ledger.settledStripeInvoiceId) ||
      ledger.bindingStatus !== 'active' ||
      ledger.bindingCancelAtPeriodEnd !== true ||
      ledger.localStatus !== 'active' ||
      ledger.localCancelAtPeriodEnd !== true ||
      ledger.settledInvoiceStatus !== 'paid' ||
      ledger.hasBlockingReversal !== false)
    throw new Error('Resumption is not eligible in the current tenant ledger');

  const end = new Date(ledger.localPeriodEndsAt).getTime();
  if (!Number.isFinite(now) || !Number.isFinite(end) || end <= now ||
      !ledger.bindingLastPeriodEndsAt ||
      new Date(ledger.bindingLastPeriodEndsAt).getTime() !== end ||
      new Date(ledger.settledPeriodEndsAt).getTime() !== end)
    throw new Error('Resumption has no unexpired, verified paid period');

  if (sub.object !== 'subscription' || sub.livemode !== false ||
      sub.id !== ledger.stripeSubscriptionId ||
      ref(sub.customer) !== ledger.stripeCustomerId ||
      sub.status !== 'active' || sub.cancel_at_period_end !== false ||
      ref(sub.latest_invoice) !== ledger.settledStripeInvoiceId ||
      sub.metadata?.tenantId !== ledger.tenantId ||
      sub.metadata?.planId !== ledger.planId)
    throw new Error('Provider does not confirm the paid tenant resumption');

  const page = sub.items;
  if (!Array.isArray(page?.data) || page.data.length !== 1 ||
      (page.has_more !== undefined && page.has_more !== false) ||
      (page.total_count !== undefined && page.total_count !== 1) ||
      ref(page.data[0]?.price) !== ledger.stripePriceId ||
      page.data[0]?.quantity !== 1)
    throw new Error('Provider resumption price list is incomplete or changed');
  const oldEnd = sub.current_period_end;
  const newEnd = page.data[0].current_period_end;
  if ((oldEnd != null && (!Number.isSafeInteger(oldEnd) || oldEnd * 1000 !== end)) ||
      (newEnd != null && (!Number.isSafeInteger(newEnd) || newEnd * 1000 !== end)) ||
      (oldEnd == null && newEnd == null))
    throw new Error('Provider period does not match immutable paid entitlement');
}
