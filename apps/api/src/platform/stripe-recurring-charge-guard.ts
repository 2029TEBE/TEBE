/**
 * C38: a paid invoice alone does not prove its charge remains collectible.
 * Stripe can leave Invoice.paid and PaymentIntent.succeeded unchanged after
 * a refund or dispute. Before a NEW recurring entitlement is granted,
 * independently GET the latest Charge and reject reversed/disputed funds.
 * This guard is TEST-only; it never writes or grants an entitlement.
 */
import type { VerifiedRecurringSettlement, TrustedRecurringBinding } from './stripe-recurring-reconciliation';

const ref = (value: any): string | null =>
  typeof value === 'string' ? value :
    value && typeof value === 'object' && typeof value.id === 'string' ? value.id : null;
const id = (prefix: string, value: unknown): value is string =>
  typeof value === 'string' && new RegExp('^' + prefix + '[A-Za-z0-9]+$').test(value);

export function recurringPaidChargeId(intentValue: unknown): string {
  const intent = intentValue as any;
  const chargeId = ref(intent?.latest_charge);
  if (!id('ch_', chargeId))
    throw new Error('Recurring paid invoice has no independently retrievable Charge');
  return chargeId;
}

/** Called only after the signed webhook and independent Invoice/Subscription/Intent/Price GETs. */
export function assertUnreversedRecurringCharge(
  intentValue: unknown, chargeValue: unknown,
  binding: TrustedRecurringBinding, verified: VerifiedRecurringSettlement,
  liveMode: boolean,
): void {
  const intent = intentValue as any;
  const charge = chargeValue as any;
  if (liveMode || !binding || !verified ||
      verified.tenantId !== binding.tenantId ||
      verified.subscriptionId !== binding.subscriptionId ||
      verified.planId !== binding.planId ||
      verified.stripeSubscriptionId !== binding.stripeSubscriptionId ||
      !Number.isSafeInteger(verified.amountMinor) || verified.amountMinor <= 0 ||
      !['SAR', 'USD'].includes(verified.currency) ||
      !intent || intent.object !== 'payment_intent' ||
      intent.livemode !== false || intent.status !== 'succeeded' ||
      intent.id !== verified.paymentIntentId ||
      ref(intent.customer) !== binding.stripeCustomerId ||
      ref(intent.invoice) !== verified.stripeInvoiceId ||
      intent.amount_received !== verified.amountMinor ||
      intent.currency !== verified.currency.toLowerCase() ||
      !charge || charge.object !== 'charge' || charge.livemode !== false ||
      charge.id !== recurringPaidChargeId(intent) ||
      ref(charge.payment_intent) !== verified.paymentIntentId ||
      ref(charge.customer) !== binding.stripeCustomerId ||
      charge.currency !== verified.currency.toLowerCase() ||
      charge.status !== 'succeeded' || charge.paid !== true ||
      charge.captured !== true ||
      charge.amount !== verified.amountMinor ||
      charge.amount_captured !== verified.amountMinor ||
      charge.amount_refunded !== 0 ||
      charge.refunded !== false || charge.disputed !== false)
    throw new Error('Recurring Charge is reversed, disputed or not bound to verified tenant funds');
}
