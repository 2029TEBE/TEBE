import { reconcileTestWebhook } from './commercial-webhook-reconciliation.mjs';

/**
 * C58 transaction boundary for verified Stripe TEST events.
 * Adapter MUST provide a real database SERIALIZABLE transaction, a tenant-scoped
 * subscription row lock, and a UNIQUE(account_id,event_id) event claim.
 * No network/provider calls may occur within this transaction.
 * Do not wire to HTTP before raw-body Stripe signature verification.
 */
export async function persistVerifiedTestEvent({ event, binding, verifiedSignature, database }) {
  if (verifiedSignature !== true) throw Error('Stripe signature verification required');
  if (!event || event.livemode !== false || !event.id || !Number.isSafeInteger(event.created) || event.created <= 0)
    throw Error('Invalid TEST event timestamp or mode');
  if (!binding || binding.mode !== 'test' || binding.deployment !== 'shared_saas' ||
      !binding.tenantId || !binding.accountId || !binding.subscriptionId)
    throw Error('Invalid tenant deployment binding');
  if (!database || typeof database.withSerializableTenantTransaction !== 'function')
    throw Error('Durable transaction adapter required');

  return database.withSerializableTenantTransaction(binding.tenantId, async tx => {
    // Lock before claiming: two simultaneous deliveries must not both mutate entitlements.
    await tx.lockSubscription(binding.accountId, binding.subscriptionId);
    const claimed = await tx.claimEvent(binding.accountId, event.id, event.type);
    const current = await tx.getSubscriptionState(binding.accountId, binding.subscriptionId);
    const decision = reconcileTestWebhook({
      event, binding, current, verifiedSignature, previouslyProcessed: !claimed,
    });
    if (decision.action === 'duplicate') return decision;
    if (decision.action === 'stale') {
      await tx.finishEvent(binding.accountId, event.id, 'stale');
      return decision;
    }
    if (decision.grant || decision.revoke) {
      await tx.setEntitlement(binding.accountId, binding.subscriptionId, {
        tenantId: binding.tenantId, enabled: decision.grant,
        sourceEventId: event.id,
      });
    }
    await tx.setSubscriptionState(binding.accountId, binding.subscriptionId, {
      tenantId: binding.tenantId, lastEventCreated: event.created,
      lastEventId: event.id, lastDecision: decision.action,
    });
    await tx.finishEvent(binding.accountId, event.id, decision.action);
    return decision;
  });
}
