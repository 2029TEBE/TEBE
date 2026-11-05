import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Paddle Billing raw-body HMAC boundary. Zero entitlement, payment and DB
 * mutations; event processing is intentionally disabled until durable,
 * idempotent, tenant-bound subscription settlement is integrated.
 * Official format: Paddle-Signature: ts=<unix>;h1=<hex HMAC of ts:rawBody>.
 */
export function verifyPaddleSignature(rawBody, signatureHeader, endpointSecret, nowSeconds = Math.floor(Date.now()/1000), maxSkewSeconds = 5) {
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0 || rawBody.length > 1024 * 1024 ||
      typeof signatureHeader !== 'string' || signatureHeader.length > 2048 ||
      typeof endpointSecret !== 'string' || endpointSecret.length < 12 ||
      !Number.isSafeInteger(nowSeconds) || !Number.isSafeInteger(maxSkewSeconds) || maxSkewSeconds < 1 || maxSkewSeconds > 300)
    return false;
  const items = signatureHeader.split(';').map(s=>s.trim());
  const timestamps = items.filter(s=>s.startsWith('ts='));
  const macs = items.filter(s=>s.startsWith('h1='));
  if (timestamps.length !== 1 || macs.length < 1 || macs.length > 4 || items.length !== timestamps.length + macs.length) return false;
  const timestamp = timestamps[0].slice(3);
  if (!/^[1-9]\d{8,11}$/.test(timestamp)) return false;
  const value = Number(timestamp);
  if (!Number.isSafeInteger(value) || Math.abs(nowSeconds - value) > maxSkewSeconds) return false;
  const expected = createHmac('sha256',endpointSecret).update(timestamp).update(':').update(rawBody).digest();
  return macs.some(item => {
    const hex = item.slice(3);
    return /^[a-fA-F0-9]{64}$/.test(hex) &&
      timingSafeEqual(Buffer.from(hex,'hex'),expected);
  });
}

export function paddleEventIdentity(rawBody, signatureHeader, endpointSecret, nowSeconds) {
  if (!verifyPaddleSignature(rawBody,signatureHeader,endpointSecret,nowSeconds)) return null;
  let event;
  try { event = JSON.parse(rawBody.toString('utf8')); } catch { return null; }
  if (!event || Array.isArray(event) || typeof event !== 'object' ||
      typeof event.event_id !== 'string' || !/^evt_[a-z0-9]{26}$/.test(event.event_id) ||
      typeof event.event_type !== 'string' ||
      !['transaction.completed','subscription.created','subscription.updated','subscription.activated',
        'subscription.canceled','subscription.past_due','subscription.paused','subscription.resumed'].includes(event.event_type) ||
      !event.data || typeof event.data !== 'object' || Array.isArray(event.data) ||
      typeof event.data.id !== 'string')
    return null;
  return { id:event.event_id, type:event.event_type, objectId:event.data.id };
}
