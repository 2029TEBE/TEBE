// C61: Server-side Stripe TEST checkout redirect policy. No provider I/O.
// Never accept redirect URLs or allowlists from browser/client request bodies.
function originFromTrusted(value) {
  if (typeof value !== 'string' || !value || /[?#]/.test(value)) throw Error('invalid trusted origin');
  const u = new URL(value);
  if (u.username || u.password || u.pathname !== '/' || !['https:', 'http:'].includes(u.protocol))
    throw Error('invalid trusted origin');
  if (u.protocol !== 'https:' && !(u.hostname === 'localhost' || u.hostname === '127.0.0.1'))
    throw Error('HTTPS required');
  if (u.origin !== value.replace(/\/$/, '')) throw Error('origin must be canonical');
  return u.origin;
}
export function buildTestCheckoutRedirects({trustedOrigin, allowedOrigins, deployment, mode, tenantId}) {
  if (mode !== 'test' || deployment !== 'shared_saas') throw Error('self-service TEST SaaS only');
  if (typeof tenantId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(tenantId)) throw Error('invalid tenant');
  if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) throw Error('trusted allowlist required');
  const origin = originFromTrusted(trustedOrigin);
  if (!allowedOrigins.some(v => originFromTrusted(v) === origin)) throw Error('unapproved checkout origin');
  const success = new URL('/billing/checkout/success', origin);
  success.searchParams.set('tenant', tenantId);
  // Stripe substitutes this token after checkout; preserve its braces verbatim.
  success.searchParams.set('session_id', 'STRIPE_SESSION_PLACEHOLDER');
  const successUrl = success.toString().replace('STRIPE_SESSION_PLACEHOLDER', '{CHECKOUT_SESSION_ID}');
  const cancel = new URL('/billing/checkout/cancel', origin);
  cancel.searchParams.set('tenant', tenantId);
  return Object.freeze({successUrl, cancelUrl:cancel.toString()});
}
