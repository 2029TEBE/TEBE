/** C56: shared SaaS vs dedicated enterprise commercial boundary.
 * Pure policy module: no payment, provisioning, network or persistence.
 * Call from quote/checkout controllers before creating provider sessions.
 */
export function evaluateCommercialRequest(request, deployment) {
  const deny = (reason) => ({ allowed: false, reason, checkout: false, provision: false });
  if (!request || !deployment || typeof request !== 'object' || typeof deployment !== 'object') return deny('invalid_context');
  if (!['shared_saas', 'dedicated_enterprise'].includes(deployment.kind)) return deny('unknown_deployment');
  if (typeof request.tenantId !== 'string' || !/^[0-9a-f-]{36}$/i.test(request.tenantId) ||
      request.tenantId !== deployment.tenantId) return deny('tenant_mismatch');
  if (typeof deployment.billingAccountId !== 'string' || !/^[a-zA-Z0-9_-]{3,100}$/.test(deployment.billingAccountId))
    return deny('billing_account_missing');
  if (request.billingAccountId !== deployment.billingAccountId) return deny('billing_account_mismatch');
  if (request.mode !== 'test' || deployment.stripeMode !== 'test') return deny('test_mode_required');
  if (request.action === 'request_quote' && deployment.kind === 'dedicated_enterprise')
    return { allowed: true, reason: 'manual_quote_only', checkout: false, provision: false };
  if (request.action !== 'checkout') return deny('unsupported_action');
  if (deployment.kind !== 'shared_saas') return deny('dedicated_checkout_forbidden');
  if (deployment.approvalRequired === true || deployment.government === true) return deny('manual_approval_required');
  if (request.priceId !== deployment.approvedTestPriceId || !/^price_[A-Za-z0-9]+$/.test(request.priceId || ''))
    return deny('price_mismatch');
  if (request.currency !== 'sar' || deployment.currency !== 'sar') return deny('currency_mismatch');
  if (!Number.isSafeInteger(request.amountMinor) || request.amountMinor <= 0 ||
      request.amountMinor !== deployment.amountMinor) return deny('amount_mismatch');
  return { allowed: true, reason: 'shared_test_checkout_only', checkout: true, provision: false };
}
