/** Paddle Billing signature boundary. No settlement or entitlement side effects.
 * Verification MUST happen on the unmodified raw HTTP request body before JSON
 * parsing, tenant lookup, or billing mutations.
 * https://developer.paddle.com/webhooks/about/signature-verification/
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_BODY_BYTES = 262_144;
const MAX_HEADER_BYTES = 2048;
const DEFAULT_TOLERANCE_MS = 5_000;

/** Paddle signs the UTF-8 bytes of `ts:rawBody` with SHA256 HMAC. */
export function verifyPaddleSignature(
  rawBody: Buffer | undefined,
  header: unknown,
  secret: string | undefined,
  nowMs: number = Date.now(),
  toleranceMs: number = DEFAULT_TOLERANCE_MS,
): boolean {
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0 || rawBody.length > MAX_BODY_BYTES ||
      typeof header !== 'string' || header.length === 0 || header.length > MAX_HEADER_BYTES ||
      typeof secret !== 'string' || secret.length < 16 || !Number.isFinite(nowMs) ||
      !Number.isSafeInteger(toleranceMs) || toleranceMs < 0 || toleranceMs > 300_000) return false;

  const fields = header.split(';').map(field => field.trim());
  const timestamps = fields.filter(field => /^ts=[0-9]+$/.test(field));
  const hashes = fields.filter(field => /^h1=[0-9a-fA-F]{64}$/.test(field));
  if (timestamps.length !== 1 || hashes.length === 0 ||
      fields.some(field => !/^ts=[0-9]+$|^h1=[0-9a-fA-F]{64}$/.test(field))) return false;

  const timestamp = timestamps[0].slice(3);
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || seconds <= 0 ||
      Math.abs(nowMs - seconds * 1000) > toleranceMs) return false;

  const expected = createHmac('sha256', secret)
    .update(timestamp).update(':').update(rawBody).digest();
  return hashes.some(field => {
    const received = Buffer.from(field.slice(3), 'hex');
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

/** Parse event metadata only AFTER a successful signature verification.
 * No event alone is sufficient to grant a customer paid entitlements.
 */
export function parseVerifiedPaddleEvent(rawBody: Buffer):
  { eventId: string; eventType: string; occurredAt: string; data: Record<string, unknown> } {
  if (!Buffer.isBuffer(rawBody) || !rawBody.length || rawBody.length > MAX_BODY_BYTES)
    throw new Error('Invalid Paddle body');
  let candidate: unknown;
  try { candidate = JSON.parse(rawBody.toString('utf8')); }
  catch { throw new Error('Invalid Paddle JSON'); }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
    throw new Error('Invalid Paddle event');
  const event = candidate as Record<string, unknown>;
  if (typeof event.event_id !== 'string' || !/^evt_[a-zA-Z0-9]+$/.test(event.event_id) ||
      typeof event.event_type !== 'string' || !/^[a-z_]+[.][a-z_]+$/.test(event.event_type) ||
      typeof event.occurred_at !== 'string' ||
      !Number.isFinite(Date.parse(event.occurred_at)) ||
      !event.data || typeof event.data !== 'object' || Array.isArray(event.data))
    throw new Error('Invalid Paddle event metadata');
  return { eventId: event.event_id, eventType: event.event_type,
    occurredAt: event.occurred_at, data: event.data as Record<string, unknown> };
}
