/**
 * Approved sandbox-only Paddle catalogue for offline checkout preparation.
 * NEVER import this into a live checkout route without an independent server-side
 * catalogue/tenant/invoice review. This module makes NO network or database calls.
 */
const TEAM_WORKSPACE = Object.freeze({
  key: 'team_workspace_monthly',
  environment: 'sandbox',
  productId: 'pro_01m6x789k8kmvez6zk7cm17wdz',
  paddlePriceId: 'pri_01m6x7w5zy16nktzjwg2ezas2d',
  amountMinor: 4900,
  currency: 'USD',
  interval: 'month',
  frequency: 1,
});

const deny = reason => ({ ok: false, reason, collectionEnabled: false, entitlementGranted: false });

/**
 * This resolver accepts ONLY a plan-key selector from the caller, not Paddle IDs
 * or prices. Its inputs are explicit so a wrong/missing deployment environment
 * cannot silently inherit a sandbox or production default.
 */
export function resolveVerifiedSandboxPrice(planKey, {
  deploymentEnv,
  paddleEnv,
  paddleEnabled,
  billingProvider,
} = {}) {
  if (deploymentEnv !== 'development' && deploymentEnv !== 'staging')
    return deny('non_sandbox_deployment');
  if (paddleEnv !== 'sandbox' || billingProvider !== 'paddle' || paddleEnabled !== 'false')
    return deny('payment_environment_must_remain_disabled');
  if (typeof planKey !== 'string' || planKey !== TEAM_WORKSPACE.key)
    return deny('plan_not_approved');
  const { key, ...data } = TEAM_WORKSPACE;
  return Object.freeze({
    ok: true,
    planKey: key,
    source: 'verified-sandbox-catalogue',
    ...data,
    collectionEnabled: false,
    entitlementGranted: false,
  });
}
