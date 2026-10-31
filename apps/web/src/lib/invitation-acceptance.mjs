/** A successful HTTP response is not proof that an invitation was consumed.
 * Require the exact JSON acknowledgement from our same-origin proxy.
 * Never trust a followed login redirect, HTML error page or empty 2xx body.
 */
export function invitationAcceptedResponse(response, payload) {
  if (!response || response.status !== 200 || response.redirected) return false;
  const contentType = response.contentType;
  if (typeof contentType !== 'string' ||
      !/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|\s*$)/i.test(contentType)) return false;
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload) &&
    payload.ok === true;
}
