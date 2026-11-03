/**
 * Offline Paddle subscription lifecycle preflight, NOT a settlement authority.
 * Only a verified Paddle-Signature over the original raw body and a locked,
 * server-owned tenant/subscription/provider binding may reach this function.
 * Never grant access from subscription status alone: a separately verified
 * completed transaction and durable tenant-matched settlement are mandatory.
 */
const ID = /^sub_[a-z0-9]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(['subscription.created','subscription.updated','subscription.canceled','subscription.past_due']);
const deny = reason => ({ accepted:false, reason, grantEntitlement:false, requiresAtomicPersistence:false });
export function evaluatePaddleLifecycle(event, binding, { signatureVerified=false }={}) {
  if (!signatureVerified) return deny('unsigned');
  if (!event || !TYPES.has(event.event_type) || !/^evt_[a-z0-9]{20,}$/.test(event.event_id || ''))
    return deny('invalid_event');
  const data=event.data;
  if (!data || !ID.test(data.id || '') || !binding || binding.provider!=='paddle' ||
      binding.environment!=='sandbox' || !UUID.test(binding.tenantId || '') ||
      !UUID.test(binding.subscriptionId || '') || binding.providerSubscriptionId!==data.id)
    return deny('untrusted_binding');
  if (data.custom_data?.tenantId && data.custom_data.tenantId!==binding.tenantId)
    return deny('tenant_mismatch');
  const expected={ 'subscription.created':['active','trialing'], 'subscription.updated':['active','trialing','past_due','paused','canceled'],
    'subscription.canceled':['canceled'], 'subscription.past_due':['past_due'] };
  if (!expected[event.event_type].includes(data.status)) return deny('status_mismatch');
  if (typeof data.updated_at!=='string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(data.updated_at) ||
      !Number.isFinite(Date.parse(data.updated_at)) || !/(Z|[+-][0-9]{2}:[0-9]{2})$/.test(data.updated_at)) return deny('missing_ordering');
  // The persisted watermark must come from the locked tenant/provider row, never the request.
  // Equal timestamps cannot safely resolve conflicting lifecycle states.
  if (binding.lastProviderUpdatedAt !== undefined && binding.lastProviderUpdatedAt !== null) {
    const last=Date.parse(binding.lastProviderUpdatedAt);
    if (!Number.isFinite(last)) return deny('invalid_watermark');
    const incoming=Date.parse(data.updated_at);
    if (incoming < last) return deny('stale_event');
    if (incoming === last && binding.lastProviderStatus !== data.status) return deny('conflicting_event');
  }
  // Never treat provider subscription status as payment evidence.
  return {accepted:true,eventId:event.event_id,tenantId:binding.tenantId,
    subscriptionId:binding.subscriptionId,providerSubscriptionId:data.id,
    providerStatus:data.status,providerUpdatedAt:data.updated_at,
    // Apply only under the same tenant-scoped transaction lock as the receipt insert.
    isReplay:binding.lastProviderUpdatedAt!=null && Date.parse(binding.lastProviderUpdatedAt)===Date.parse(data.updated_at),
    grantEntitlement:false,requiresAtomicPersistence:true,
    requiresVerifiedSettlementForAccess:true};
}
