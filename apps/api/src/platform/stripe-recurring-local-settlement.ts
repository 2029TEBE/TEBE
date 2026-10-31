/**
 * C32: local subscription guard for Stripe TEST invoice settlement.
 * Provider verification happens separately. No caller-provided tenant or
 * invoice metadata can select a subscription or bypass the tenant lock.
 */
import type { TrustedRecurringBinding, VerifiedRecurringSettlement } from './stripe-recurring-reconciliation';

export type LocalRecurringSubscription = Readonly<{
  id: string; planId: string; status: string; cancelAtPeriodEnd: boolean;
  periodStartsAt: string | Date; periodEndsAt: string | Date;
}>;

export function assertRecurringLocalSettlement(
  binding: TrustedRecurringBinding, local: LocalRecurringSubscription,
  verified: VerifiedRecurringSettlement, latestSubscriptionId: string,
  now: number = Date.now(),
  // C37: proof of a C34 failed invoice for this exact tenant/invoice/period.
  // Never accept a generic past_due state as authorization to restore access.
  failedInvoiceRecovery: boolean = false,
): void {
  if (!binding || !local || !verified || latestSubscriptionId !== binding.subscriptionId ||
      local.id !== binding.subscriptionId || local.planId !== binding.planId ||
      verified.tenantId !== binding.tenantId ||
      verified.subscriptionId !== binding.subscriptionId ||
      verified.planId !== binding.planId ||
      verified.stripeSubscriptionId !== binding.stripeSubscriptionId ||
      local.cancelAtPeriodEnd !== false || binding.cancelAtPeriodEnd !== false)
    throw new Error('Recurring settlement does not belong to the current tenant subscription');
  const start = Date.parse(verified.periodStartsAt);
  const end = Date.parse(verified.periodEndsAt);
  const localStart = new Date(local.periodStartsAt).getTime();
  const localEnd = new Date(local.periodEndsAt).getTime();
  if (![start, end, localStart, localEnd, now].every(Number.isFinite) ||
      start >= end || end <= now || localStart >= localEnd)
    throw new Error('Recurring entitlement period is invalid or already expired');
  if (binding.status === 'pending') {
    if (binding.lastPeriodEndsAt !== null || !['trialing', 'past_due'].includes(local.status) ||
        start < localStart)
      throw new Error('Initial recurring invoice cannot activate this subscription');
  } else if (binding.status === 'active') {
    // C34 can mark the *expired* paid period past_due after a failed renewal.
    // A later genuinely paid, provider-verified invoice may recover it, but
    // only when the exact failed invoice was recorded under this tenant lock.
    // Never restore a manually paused/canceled or still-current entitlement.
    const recoverExpiredFailure = local.status === 'past_due' &&
      failedInvoiceRecovery === true && localEnd <= now;
    if ((local.status !== 'active' && !recoverExpiredFailure) ||
        !binding.lastPeriodEndsAt ||
        new Date(binding.lastPeriodEndsAt).getTime() !== localEnd ||
        start !== localEnd)
      throw new Error('Recurring renewal is not contiguous with the local entitlement');
  } else {
    throw new Error('Invalid recurring binding state');
  }
}
