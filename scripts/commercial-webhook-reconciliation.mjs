// Pure Stripe TEST webhook reconciliation decision. Caller MUST verify raw-body Stripe signature
// and persist event ID, subscription state and entitlement in ONE SERIALIZABLE DB transaction.
// Never call this module before signature verification. It does not perform provider I/O.
const accepted = new Set(['invoice.paid','invoice.payment_failed','invoice.payment_action_required','customer.subscription.updated','customer.subscription.deleted','charge.refunded','charge.dispute.created']);
const inactive = new Set(['canceled','unpaid','incomplete_expired','paused']);
const active = new Set(['active','trialing']);
const str = v => typeof v === 'string' && v.length > 0;
export function reconcileTestWebhook({event, binding, current, verifiedSignature, previouslyProcessed=false}) {
  if (verifiedSignature !== true) throw Error('verified Stripe signature required');
  if (!event || !str(event.id) || !Number.isSafeInteger(event.created) || event.created <= 0 || !accepted.has(event.type) || event.livemode !== false) throw Error('unsupported or non-TEST Stripe event');
  if (!binding || binding.mode !== 'test' || binding.deployment !== 'shared_saas' || !str(binding.tenantId) || !str(binding.accountId) || !str(binding.customerId) || !str(binding.subscriptionId) || !str(binding.currency)) throw Error('invalid shared SaaS binding');
  if (previouslyProcessed) return Object.freeze({action:'duplicate',grant:false,revoke:false});
  const o=event.data?.object;
  if (!o || typeof o !== 'object' || o.livemode === true) throw Error('invalid event object mode');
  const subscription = event.type.startsWith('customer.subscription.') ? o.id : (o.subscription || o.parent?.subscription_details?.subscription);
  const customer = typeof o.customer === 'string' ? o.customer : o.customer?.id;
  const account = event.account || binding.accountId;
  if (subscription !== binding.subscriptionId || customer !== binding.customerId || account !== binding.accountId) throw Error('cross-account/customer/subscription event');
  if (event.type.startsWith('invoice.')) {
    if (!str(o.currency) || o.currency.toLowerCase() !== binding.currency.toLowerCase() || !Number.isSafeInteger(o.amount_due) || o.amount_due < 0 || !Number.isSafeInteger(o.amount_paid) || o.amount_paid < 0) throw Error('invoice currency/amount invalid');
    if (event.type === 'invoice.paid' && (o.paid !== true || o.status !== 'paid' || o.amount_paid < o.amount_due)) throw Error('invoice not settled');
    // A paid invoice is not evidence of a purchased plan unless the amount
    // matches the trusted server-side price. Do not accept client metadata.
    if (event.type === 'invoice.paid' && (!Number.isSafeInteger(binding.expectedAmountMinor) || binding.expectedAmountMinor < 0 || o.amount_due !== binding.expectedAmountMinor)) throw Error('invoice price mismatch');
  }
  if (current && (current.lastEventCreated > event.created || (current.lastEventCreated === event.created && current.lastEventId && current.lastEventId !== event.id))) return Object.freeze({action:'stale',grant:false,revoke:false});
  let action='observe';
  if (event.type === 'invoice.paid') action='grant';
  if (event.type === 'invoice.payment_failed' || event.type === 'invoice.payment_action_required' || event.type === 'customer.subscription.deleted' || event.type === 'charge.refunded' || event.type === 'charge.dispute.created') action='revoke';
  if (event.type === 'customer.subscription.updated') {
    if (active.has(o.status)) action='observe'; // never grant solely on subscription.updated
    else if (inactive.has(o.status) || o.status === 'past_due') action='revoke';
    else throw Error('unknown subscription state');
  }
  return Object.freeze({action,grant:action==='grant',revoke:action==='revoke',eventId:event.id,eventCreated:event.created});
}
