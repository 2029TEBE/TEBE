/** Password recovery is a single-use security mutation. A 2xx status alone is
 * not proof of a committed reset or accepted recovery request: a login page,
 * intermediary redirect, or malformed reply must never produce success UI.
 * The same-origin Next.js proxy contract is exactly HTTP 200 JSON {ok:true}.
 */
export function recoveryAcknowledged(response, payload) {
  if (!response || response.status !== 200 || response.redirected !== false) return false;
  const type = response.headers?.get?.('content-type');
  if (typeof type !== 'string' || !/^application\/json(?:\s*;|\s*$)/i.test(type)) return false;
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload) && payload.ok === true;
}
