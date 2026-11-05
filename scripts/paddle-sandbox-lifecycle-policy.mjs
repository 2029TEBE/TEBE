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
// Validate calendar components and explicit timezone before comparing provider watermarks.
// Date.parse alone normalizes invalid calendar dates and coerces non-string values.
function providerTimestamp(value) {
  if (typeof value !== 'string') return null;
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!m) return null;
  const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number);
  const offsetHours=Number(m[10]||0),offsetMinutes=Number(m[11]||0);
  if (year<1 || month<1 || month>12 || day<1 || day>31 || hour>23 || minute>59 || second>59 || offsetHours>23 || offsetMinutes>59) return null;
  const offset=(m[9]==='-'?-1:1)*(offsetHours*60+offsetMinutes);
  const millis=Date.parse(value);
  if (!Number.isFinite(millis)) return null;
  const local=new Date(millis+offset*60000);
  if (local.getUTCFullYear()!==year || local.getUTCMonth()+1!==month || local.getUTCDate()!==day ||
      local.getUTCHours()!==hour || local.getUTCMinutes()!==minute || local.getUTCSeconds()!==second) return null;
  return millis;
}
export function evaluatePaddleLifecycle(event, binding, { signatureVerified=false }={}) {
  if (!signatureVerified) return deny('unsigned');
  if (!event || !TYPES.has(event.event_type) || !/^evt_[a-z0-9]{20,}$/.test(event.event_id || ''))
    return deny('invalid_event');
  const data=event.data;
  if (!data || !ID.test(data.id || '') || !binding || binding.provider!=='paddle' ||
      binding.environment!=='sandbox' || !UUID.test(binding.tenantId || '') ||
      !UUID.test(binding.subscriptionId || '') || binding.providerSubscriptionId!==data.id)
    return deny('untrusted_binding');
  if (Object.hasOwn(data, 'custom_data') && (data.custom_data === null || typeof data.custom_data !== 'object' || Array.isArray(data.custom_data)))
    return deny('invalid_custom_data');
  if (data.custom_data && Object.hasOwn(data.custom_data, 'tenantId') && data.custom_data.tenantId!==binding.tenantId)
    return deny('tenant_mismatch');
  const expected={ 'subscription.created':['active','trialing'], 'subscription.updated':['active','trialing','past_due','paused','canceled'],
    'subscription.canceled':['canceled'], 'subscription.past_due':['past_due'] };
  if (!expected[event.event_type].includes(data.status)) return deny('status_mismatch');
  const incoming=providerTimestamp(data.updated_at);
  if (incoming===null) return deny('missing_ordering');
  // The persisted watermark must come from the locked tenant/provider row, never the request.
  // Equal timestamps cannot safely resolve conflicting lifecycle states.
  // A persisted watermark is an indivisible tenant-scoped tuple. Reject partial,
  // null or malformed tuples instead of treating them as a fresh subscription.
  const watermarkKeys=['lastProviderUpdatedAt','lastProviderStatus','lastProviderEventId'];
  const hasWatermark=watermarkKeys.some(key=>Object.hasOwn(binding,key));
  if (hasWatermark && (watermarkKeys.some(key=>!Object.hasOwn(binding,key)) ||
      providerTimestamp(binding.lastProviderUpdatedAt)===null ||
      !['active','trialing','past_due','paused','canceled'].includes(binding.lastProviderStatus) ||
      !/^evt_[a-z0-9]{20,}$/.test(binding.lastProviderEventId || '')))
    return deny('invalid_watermark');
  if (hasWatermark) {
    const last=providerTimestamp(binding.lastProviderUpdatedAt);
    if (last===null) return deny('invalid_watermark');
    if (incoming < last) return deny('stale_event');
    if (incoming === last && binding.lastProviderStatus !== data.status) return deny('conflicting_event');
    // Same timestamp/status is a replay only when its immutable provider event ID matches.
    // Otherwise two distinct events cannot be ordered safely and must not overwrite the watermark.
    if (incoming === last && (!/^evt_[a-z0-9]{20,}$/.test(binding.lastProviderEventId || '') ||
        binding.lastProviderEventId !== event.event_id)) return deny('ambiguous_replay');
  }
  // Never treat provider subscription status as payment evidence.
  return {accepted:true,eventId:event.event_id,tenantId:binding.tenantId,
    subscriptionId:binding.subscriptionId,providerSubscriptionId:data.id,
    providerStatus:data.status,providerUpdatedAt:data.updated_at,
    // Apply only under the same tenant-scoped transaction lock as the receipt insert.
    isReplay:binding.lastProviderUpdatedAt!=null && providerTimestamp(binding.lastProviderUpdatedAt)===incoming,
    grantEntitlement:false,requiresAtomicPersistence:true,
    requiresVerifiedSettlementForAccess:true};
}
