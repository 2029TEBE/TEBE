import { createHmac, timingSafeEqual } from 'node:crypto';
import { persistVerifiedTestEvent } from './commercial-webhook-transaction.mjs';

/**
 * C62 Stripe TEST-only HTTP boundary. Nest controller should pass its raw Buffer,
 * Stripe-Signature header, and a server-side tenant binding resolver. Never use
 * JSON.stringify(req.body) as signature input; do not trust event metadata as a binding.
 * This module performs no Stripe network requests and requires an injected database.
 */
export function verifyTestStripeSignature({rawBody, signature, secret, now=Math.floor(Date.now()/1000), tolerance=300}) {
  if (!Buffer.isBuffer(rawBody) || rawBody.length===0 || rawBody.length>1024*1024) throw Error('raw Stripe body required');
  if (typeof secret!=='string' || !secret.startsWith('whsec_') || secret.length<12) throw Error('TEST webhook secret required');
  if (typeof signature!=='string' || signature.length>4096) throw Error('invalid Stripe signature header');
  const parts=signature.split(',').map(s=>s.trim());
  const timestampPart=parts.find(s=>/^t=\d+$/.test(s));
  const ts=timestampPart ? Number(timestampPart.slice(2)) : NaN;
  if (!Number.isSafeInteger(ts) || ts<=0 || !Number.isSafeInteger(now) || Math.abs(now-ts)>tolerance) throw Error('Stripe signature timestamp rejected');
  const expected=createHmac('sha256',secret).update(String(ts)).update('.').update(rawBody).digest();
  const candidates=parts.filter(s=>/^v1=[a-f0-9]{64}$/i.test(s));
  if (!candidates.some(s=>timingSafeEqual(expected,Buffer.from(s.slice(3),'hex')))) throw Error('Stripe signature invalid');
  return true;
}
export async function handleSignedTestStripeWebhook({rawBody,signature,secret,resolveBinding,database,now}) {
  verifyTestStripeSignature({rawBody,signature,secret,now});
  let event;
  try { event=JSON.parse(rawBody.toString('utf8')); } catch { throw Error('Stripe event JSON invalid'); }
  if (!event || event.livemode!==false || typeof event.id!=='string' || !event.id.startsWith('evt_')) throw Error('Stripe TEST event required');
  if (typeof resolveBinding!=='function') throw Error('trusted binding resolver required');
  // Resolve from trusted persisted Stripe account/customer/subscription IDs, not
  // client-supplied tenant headers or event metadata.
  const binding=await resolveBinding({
    accountId:event.account ?? null,
    customerId:event.data?.object?.customer ?? null,
    subscriptionId:event.type?.startsWith('customer.subscription.')
      ? event.data?.object?.id
      : event.data?.object?.subscription ?? event.data?.object?.parent?.subscription_details?.subscription ?? null,
  });
  if (!binding || binding.mode!=='test' || binding.deployment!=='shared_saas') throw Error('trusted TEST SaaS binding required');
  return persistVerifiedTestEvent({event,binding,verifiedSignature:true,database});
}
