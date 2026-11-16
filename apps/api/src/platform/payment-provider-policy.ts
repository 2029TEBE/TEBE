/** Commercial provider routing for new charges. Historical payments keep
 * their original immutable provider references. This helper does NOT enable
 * charging or confer an entitlement. Stripe credentials are checked separately.
 */
export const PRIMARY_PAYMENT_PROVIDER = 'stripe' as const;

export function stripeIsSelected(value: string | undefined): boolean {
  return value === undefined || value === '' || value.trim().toLowerCase() === PRIMARY_PAYMENT_PROVIDER;
}

export function assertStripeForNewCharges(value: string | undefined): void {
  if (!stripeIsSelected(value))
    throw new Error('New purchases and renewals require Stripe as the selected payment provider');
}

export function describeBillingCapabilities() {
  return Object.freeze({
    provider: PRIMARY_PAYMENT_PROVIDER,
    supportedNow: Object.freeze(['existing-renewal-invoice-checkout']),
    notYetAvailable: Object.freeze([
      'first-purchase-self-service',
      'automatic-stripe-billing-subscriptions',
      'self-service-plan-change',
    ]),
    paidAccessRequiresVerifiedWebhook: true,
    providerSwitchDoesNotMoveExistingSubscriptions: true,
  });
}
