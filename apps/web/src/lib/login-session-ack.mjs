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
      !Array.isArray(body.tenants) || body.tenants.length < 1 || body.tenants.length > 500 ||
      !body.tenants.every(t => t && typeof t === 'object' && !Array.isArray(t) &&
        typeof t.tenantId === 'string' && UUID.test(t.tenantId) &&
        typeof t.name === 'string' && t.name.length > 0 &&
        typeof t.slug === 'string' && t.slug.length > 0 &&
        typeof t.role === 'string' && t.role.length > 0)) {
    return null;
  }
  const setCookies = response.headers?.getSetCookie?.();
  if (!Array.isArray(setCookies)) return null;
  const matches = setCookies.filter(line => typeof line === 'string' && line.startsWith(`${SESSION}=`));
  if (matches.length !== 1) return null;
  const token = matches[0].split(';', 1)[0].slice(`${SESSION}=`.length);
  return TOKEN.test(token) ? token : null;
}
