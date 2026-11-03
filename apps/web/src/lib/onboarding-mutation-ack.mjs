import { readBoundedUpstreamJson } from './bounded-upstream-body.mjs';

/**
 * The onboarding API has three different success contracts. A 2xx HTTP status
 * alone is not proof that a profile was saved, an email invitation delivered,
 * or an invitation revoked: intermediaries may return HTML sign-in pages.
 * Unknown/ambiguous outcomes must not be replayed automatically.
 */
export async function onboardingMutationAcknowledged(response, action, expected = {}) {
  const expectedStatus = action === 'profile' ? 200
    : action === 'invite' || action === 'revoke' || action === 'resend' ? 201 : null;
  if (!response || response.ok !== true || response.status !== expectedStatus ||
      response.redirected !== false ||
      !/^application\/json(?:\s*;|\s*$)/i.test(response.headers?.get?.('content-type') ?? '')) {
    return false;
  }
  const body = await readBoundedUpstreamJson(response, 4096);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (action === 'profile' || action === 'revoke') return body.ok === true;
  if (action === 'invite' || action === 'resend') {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return typeof body.id === 'string' && uuid.test(body.id) &&
      typeof body.email === 'string' && (action === 'resend' || body.email.toLowerCase() === expected.email?.trim().toLowerCase()) &&
      typeof body.role === 'string' && (action === 'resend' || body.role === expected.role) &&
      body.deliveryStatus === 'sent' &&
      typeof body.expiresAt === 'string' && Number.isFinite(Date.parse(body.expiresAt));
  }
  return false;
}
