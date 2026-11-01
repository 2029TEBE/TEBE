/**
 * C42/C45: signed TEST-only terminal and finalization-failure reconciliation.
 * A signed snapshot is never tenant authority. Caller GETs Invoice,
 * Subscription, Price and any PaymentIntent, then locks the immutable ledger.
 * No paid receipt, entitlement grant or new billing period is created here.
 */
import type { TrustedRecurringBinding } from './stripe-recurring-reconciliation';
import type { RecurringPlan } from './stripe-recurring-policy';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id = (prefix: string, value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(prefix) &&
  /^[A-Za-z0-9]+$/.test(value.slice(prefix.length)) && value.length > prefix.length;
const ref = (value: any): string | null =>
  typeof value === 'string' ? value :
  value && typeof value === 'object' && typeof value.id === 'string' ? value.id : null;

export type TerminalRecurringCandidate = Readonly<{
  eventId: string; eventType: 'invoice.voided' | 'invoice.marked_uncollectible' | 'invoice.finalization_failed';
  invoiceId: string; stripeSubscriptionId: string; stripeCustomerId: string;
  providerStatus: 'void' | 'uncollectible' | 'draft';
  billingReason: 'subscription_create' | 'subscription_cycle';
}>;
export type TerminalRecurringLocal = Readonly<{
  id: string; planId: string; status: string; cancelAtPeriodEnd: boolean;
  periodStartsAt: string | Date; periodEndsAt: string | Date;
}>;

/** Call only after the raw Stripe-Signature is verified. */
export function parseTerminalRecurringInvoice(raw: Buffer, liveMode: boolean):
  TerminalRecurringCandidate | null {
  let event: any;
  try { event = JSON.parse(raw.toString('utf8')); }
  catch { throw new Error('Invalid signed terminal invoice JSON'); }
  if (!['invoice.voided', 'invoice.marked_uncollectible', 'invoice.finalization_failed'].includes(event?.type))
    return null;
  const invoice = event?.data?.object;
  const oldSub = ref(invoice?.subscription);
  const parentSub = ref(invoice?.parent?.subscription_details?.subscription);
  if (oldSub && parentSub && oldSub !== parentSub)
    throw new Error('Conflicting terminal invoice subscription references');
  const recurring = oldSub != null || parentSub != null ||
    (typeof invoice?.billing_reason === 'string' &&
     invoice.billing_reason.startsWith('subscription_'));
  if (!recurring) {
    if (invoice?.object !== 'invoice' || invoice?.billing_reason !== 'manual')
      throw new Error('Ambiguous terminal invoice cannot be acknowledged');
    return null;
  }
  const status = event.type === 'invoice.voided' ? 'void' :
    event.type === 'invoice.marked_uncollectible' ? 'uncollectible' : 'draft';
  if (liveMode || event.livemode !== false || !id('evt_', event.id) ||
      invoice?.object !== 'invoice' || invoice.livemode !== false ||
      !id('in_', invoice.id) || !id('sub_', oldSub ?? parentSub) ||
      !id('cus_', ref(invoice.customer)) ||
      invoice.status !== status || invoice.paid !== false ||
      !['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason) ||
      (event.type === 'invoice.finalization_failed' &&
       (invoice.amount_paid !== 0 || invoice.payment_intent != null ||
        (invoice.payments != null &&
         (!Array.isArray(invoice.payments.data) || invoice.payments.data.length !== 0 ||
          invoice.payments.has_more === true)))))
    throw new Error('Invalid signed TEST recurring terminal/finalization invoice');
  return Object.freeze({
    eventId: event.id, eventType: event.type, invoiceId: invoice.id,
    stripeSubscriptionId: oldSub ?? parentSub!,
    stripeCustomerId: ref(invoice.customer)!, providerStatus: status,
    billingReason: invoice.billing_reason,
  });
}

export function assertTerminalRecurringProvider(
  candidate: TerminalRecurringCandidate, invoiceValue: unknown,
  subscriptionValue: unknown, intentValue: unknown,
  binding: TrustedRecurringBinding, plan: RecurringPlan,
  local: TerminalRecurringLocal, latestSubscriptionId: string,
  liveMode: boolean, now: number = Date.now(),
): Readonly<{ periodStartsAt: string; periodEndsAt: string; shouldPause: boolean }> {
  const invoice = invoiceValue as any, sub = subscriptionValue as any;
  if (liveMode || !candidate || !binding || !plan || !local ||
      !UUID.test(binding.tenantId) || !UUID.test(binding.subscriptionId) ||
      !UUID.test(binding.planId) || binding.planId !== plan.id ||
      latestSubscriptionId !== binding.subscriptionId ||
      local.id !== binding.subscriptionId || local.planId !== binding.planId ||
      binding.cancelAtPeriodEnd !== false || local.cancelAtPeriodEnd !== false ||
      !['pending', 'active'].includes(binding.status) ||
      !['trialing', 'active', 'past_due', 'paused'].includes(local.status) ||
      candidate.stripeSubscriptionId !== binding.stripeSubscriptionId ||
      candidate.stripeCustomerId !== binding.stripeCustomerId ||
      !id('price_', binding.stripePriceId) ||
      !Number.isSafeInteger(plan.priceMinor) || plan.priceMinor <= 0 ||
      !['monthly', 'yearly'].includes(plan.billingInterval) ||
      plan.trialDays !== 0 || plan.isActive !== true)
    throw new Error('Terminal invoice is not owned by current tenant plan');
  const initial = candidate.billingReason === 'subscription_create';
  if (initial !== (binding.status === 'pending') ||
      (initial ? binding.lastPeriodEndsAt !== null :
       !binding.lastPeriodEndsAt || !['active', 'past_due', 'paused'].includes(local.status)))
    throw new Error('Terminal invoice is out of lifecycle order');
  if (!invoice || invoice.object !== 'invoice' || invoice.livemode !== false ||
      invoice.id !== candidate.invoiceId || invoice.status !== candidate.providerStatus ||
      invoice.paid !== false || invoice.collection_method !== 'charge_automatically' ||
      invoice.billing_reason !== candidate.billingReason ||
      ref(invoice.customer) !== binding.stripeCustomerId ||
      ref(invoice.subscription ?? invoice.parent?.subscription_details?.subscription) !== binding.stripeSubscriptionId ||
      (invoice.subscription != null && invoice.parent?.subscription_details?.subscription != null &&
       ref(invoice.subscription) !== ref(invoice.parent.subscription_details.subscription)) ||
      invoice.amount_due !== plan.priceMinor || invoice.total !== plan.priceMinor ||
      invoice.amount_paid !== 0 || invoice.currency !== plan.currency.toLowerCase() ||
      (candidate.eventType === 'invoice.finalization_failed' &&
       (!invoice.last_finalization_error ||
        typeof invoice.last_finalization_error.type !== 'string' ||
        !invoice.last_finalization_error.type.trim() ||
        invoice.payment_intent != null ||
        (invoice.payments != null &&
         (!Array.isArray(invoice.payments.data) || invoice.payments.data.length !== 0 ||
          invoice.payments.has_more === true)))))
    throw new Error('Provider Invoice GET is not the exact unpaid terminal invoice');
  const page = invoice.lines;
  if (!Array.isArray(page?.data) || page.data.length !== 1 ||
      (page.has_more !== undefined && page.has_more !== false) ||
      (page.total_count !== undefined && page.total_count !== 1))
    throw new Error('Terminal invoice service line is ambiguous');
  const line = page.data[0], oldPrice = ref(line?.price);
  const newPrice = ref(line?.pricing?.price_details?.price);
  if ((oldPrice && newPrice && oldPrice !== newPrice) ||
      (oldPrice ?? newPrice) !== binding.stripePriceId ||
      line.quantity !== 1 || line.amount !== plan.priceMinor ||
      line.proration === true ||
      (line.type != null && line.type !== 'subscription') ||
      !Number.isSafeInteger(line.period?.start) ||
      !Number.isSafeInteger(line.period?.end))
    throw new Error('Terminal invoice line does not match the tenant plan');
  const start = line.period.start * 1000, end = line.period.end * 1000;
  const localStart = new Date(local.periodStartsAt).getTime();
  const localEnd = new Date(local.periodEndsAt).getTime();
  const days = (end - start) / 86_400_000;
  if (![start, end, localStart, localEnd, now].every(Number.isFinite) ||
      start <= 0 || end <= start || localEnd <= localStart ||
      (plan.billingInterval === 'monthly' ? days < 27 || days > 32 : days < 364 || days > 367) ||
      (initial ? start < localStart :
       Date.parse(binding.lastPeriodEndsAt!) !== start || localEnd !== start))
    throw new Error('Terminal invoice period is invalid or noncontiguous');
  if (!sub || sub.object !== 'subscription' || sub.livemode !== false ||
      sub.id !== binding.stripeSubscriptionId ||
      ref(sub.customer) !== binding.stripeCustomerId ||
      !['active', 'past_due', 'unpaid', 'incomplete'].includes(sub.status) ||
      sub.cancel_at_period_end !== false ||
      ref(sub.latest_invoice) !== candidate.invoiceId ||
      sub.metadata?.tenantId !== binding.tenantId ||
      sub.metadata?.planId !== binding.planId)
    throw new Error('Provider Subscription GET is not the bound latest invoice');
  const items = sub.items;
  if (!Array.isArray(items?.data) || items.data.length !== 1 ||
      (items.has_more !== undefined && items.has_more !== false) ||
      (items.total_count !== undefined && items.total_count !== 1) ||
      ref(items.data[0]?.price) !== binding.stripePriceId ||
      items.data[0]?.quantity !== 1)
    throw new Error('Terminal subscription price list is ambiguous');
  const payment = invoice.payment_intent;
  const payments = invoice.payments;
  if (payments != null &&
      (!Array.isArray(payments.data) || payments.data.length > 1 ||
       (payments.has_more !== undefined && payments.has_more !== false) ||
       (payments.total_count !== undefined && payments.total_count !== payments.data.length)))
    throw new Error('Terminal invoice payment list is incomplete');
  const direct = ref(payment);
  const fromList = payments?.data?.length ?
    ref(payments.data[0]?.payment?.payment_intent) : null;
  if ((direct && fromList && direct !== fromList) ||
      (payments?.data?.length && !fromList))
    throw new Error('Terminal invoice payment references conflict');
  const intentId = direct ?? fromList;
  if (intentId != null) {
    const intent = intentValue as any;
    if (!id('pi_', intentId) || !intent || intent.object !== 'payment_intent' ||
        intent.id !== intentId || intent.livemode !== false ||
        !['canceled', 'requires_payment_method', 'requires_action'].includes(intent.status) ||
        intent.amount !== plan.priceMinor || intent.amount_received !== 0 ||
        intent.currency !== plan.currency.toLowerCase() ||
        ref(intent.customer) !== binding.stripeCustomerId ||
        ref(intent.invoice) !== candidate.invoiceId)
      throw new Error('Terminal invoice has an unverified or collected payment');
  } else if (intentValue != null) {
    throw new Error('Unexpected terminal invoice PaymentIntent');
  }
  return Object.freeze({
    periodStartsAt: new Date(start).toISOString(),
    periodEndsAt: new Date(end).toISOString(),
    shouldPause: localEnd <= now && ['trialing', 'active'].includes(local.status),
  });
}
