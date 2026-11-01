import { readBoundedUpstreamJson } from './bounded-upstream-body.mjs';
import { fetchTenantMutation } from './tenant-mutation-fetch.mjs';
import { validSessionEnvelope } from './session-envelope.mjs';

/** A 200 status is not proof that the active workspace changed. The trusted
 * API contract is exactly a JSON {ok:true} response. Never trust an HTML
 * login page, an intermediary redirect, or an unbounded response body. */
export async function tenantSwitchAcknowledged(response) {
  if (!response || response.status !== 200 || response.redirected === true ||
      !/^application\/json(?:\s*;|\s*$)/i.test(response.headers?.get?.('content-type') ?? '')) return false;
  const body = await readBoundedUpstreamJson(response, 4096);
  return !!body && typeof body === 'object' && !Array.isArray(body) && body.ok === true;
}

/** The API currently uses 401 both for an expired session and for a tenant
 * the signed-in user does not belong to. Distinguish them using a bounded,
 * read-only session lookup; never replay the switch or follow redirects.
 * Null means unconfirmed and must be presented as unavailable, not success. */
export async function classifyTenantSwitch401(fetcher, endpoint, cookie, tenantId) {
  const response = await fetchTenantMutation(fetcher, endpoint, {
    method: 'GET', headers: { cookie }, cache: 'no-store',
  });
  if (!response) return null;
  if (response.status === 401) return 401;
  if (response.status !== 200 || response.redirected === true ||
      !/^application\/json(?:\s*;|\s*$)/i.test(response.headers?.get?.('content-type') ?? '')) return null;
  const body = await readBoundedUpstreamJson(response, 65536);
  if (!validSessionEnvelope(body)) return null;
  if (body.authenticated === false) return 401;
  // A verified session without target membership is a permission denial.
  // If membership is present, the conflicting 401 remains ambiguous.
  return body.tenants.some(t => t.tenantId === tenantId) ? null : 403;
}
