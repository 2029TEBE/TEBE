import { readBoundedUpstreamJson } from './bounded-upstream-body.mjs';

const SESSION = 'pmo_session';
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * A 200 response (or a Set-Cookie header alone) is not proof of sign-in.
 * Confirm the exact API success envelope and a single valid opaque session
 * token before installing an HttpOnly browser cookie. Never echo upstream data.
 */
export async function verifiedLoginSessionToken(response) {
  if (!response || response.ok !== true || response.status !== 200 ||
      response.redirected !== false ||
      !/^application\/json(?:\s*;|\s*$)/i.test(response.headers?.get?.('content-type') ?? '')) {
    return null;
  }
  const body = await readBoundedUpstreamJson(response, 65_536);
  if (!body || typeof body !== 'object' || Array.isArray(body) || body.ok !== true ||
      !Array.isArray(body.tenants) || body.tenants.length < 1 || body.tenants.length > 500) {
    return null;
  }
  // UUID identity is case-insensitive. Duplicate memberships (including
  // differently cased UUIDs) can carry conflicting roles or workspace names.
  // Reject the entire login acknowledgement instead of installing a cookie
  // for an ambiguous active-tenant selection.
  const seenTenantIds = new Set();
  for (const tenant of body.tenants) {
    if (!tenant || typeof tenant !== 'object' || Array.isArray(tenant) ||
        typeof tenant.tenantId !== 'string' || !UUID.test(tenant.tenantId) ||
        typeof tenant.name !== 'string' || !tenant.name.trim() ||
        typeof tenant.slug !== 'string' || !tenant.slug.trim() ||
        typeof tenant.role !== 'string' || !tenant.role.trim()) return null;
    const identity = tenant.tenantId.toLowerCase();
    if (seenTenantIds.has(identity)) return null;
    seenTenantIds.add(identity);
  }
  const setCookies = response.headers?.getSetCookie?.();
  if (!Array.isArray(setCookies)) return null;
  const matches = setCookies.filter(line => typeof line === 'string' && line.startsWith(`${SESSION}=`));
  if (matches.length !== 1) return null;
  const token = matches[0].split(';', 1)[0].slice(`${SESSION}=`.length);
  return TOKEN.test(token) ? token : null;
}
