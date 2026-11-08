/**
 * Review-only composition of a database-owned checkout intent, the verified
 * sandbox price and the existing offline Paddle checkout policy.
 *
 * The binding MUST be loaded under an authenticated tenant DB transaction and
 * contain the plan's stored financial terms. This module neither queries SQL
 * nor makes a provider call; the customer-facing route remains HTTP 503.
 */
import { resolveVerifiedSandboxPrice } from './paddle-verified-sandbox-catalog.mjs';
import { preparePaddleSandboxCheckout } from './paddle-sandbox-checkout-policy.mjs';

const deny = reason => Object.freeze({
  ok: false, reason, collectionEnabled: false, entitlementGranted: false,
});

export function prepareVerifiedTeamWorkspaceCheckout(binding, runtime, options) {
  if (!binding || typeof binding !== 'object' ||
      binding.source !== 'locked-tenant-record' ||
      binding.provider !== 'paddle' || binding.environment !== 'sandbox' ||
      binding.planKey !== 'team_workspace_monthly')
    return deny('untrusted_checkout_binding');

  const price = resolveVerifiedSandboxPrice(binding.planKey, runtime);
  if (!price.ok) return deny(price.reason);

  // Even a verified Paddle price must never silently override the tenant's
  // subscription plan/invoice terms. Resolve those from locked server SQL.
  if (binding.planAmountMinor !== price.amountMinor ||
      binding.planCurrency !== price.currency ||
      binding.planInterval !== price.interval ||
      binding.planFrequency !== price.frequency)
    return deny('tenant_plan_price_mismatch');

  const catalogue = {
    source: 'server-approved-catalogue',
    environment: 'sandbox',
    planId: binding.planId,
    paddlePriceId: price.paddlePriceId,
    amountMinor: price.amountMinor,
    currency: price.currency,
    isActive: true,
  };
  const prepared = preparePaddleSandboxCheckout(binding, catalogue, options);
  if (!prepared.ok) return deny(prepared.reason);
  return Object.freeze({
    ...prepared,
    catalogueKey: price.planKey,
    verifiedProductId: price.productId,
    collectionEnabled: false,
    entitlementGranted: false,
  });
}
